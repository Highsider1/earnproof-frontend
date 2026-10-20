"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GenericWizardSteps } from "./generic-wizard-steps";
import { InvoiceReferenceEntryStep } from "./invoice-reference-entry-step";
import { SettlementMatchStep, type SettlementCandidate } from "./settlement-match-step";
import { InvoiceSettlementConfirmation } from "./invoice-settlement-confirmation";
import { apiClient, bearer } from "@/lib/api/client";
import { appConfig } from "@/config/app";
import type { Payment } from "@/lib/api/generated/v1";
import {
  WIZARD_STEPS,
  STEP_ORDER,
  STEP_LABELS,
  DEFAULT_VALUES,
  normalizeInvoiceReference,
  invoiceReferenceSchema,
  classifySettlementMatch,
  isSupportedAssetCode,
  type WizardStep,
} from "@/lib/validation/invoice-settlement-proofs";
import {
  isReferenceBoundElsewhere,
  bindInvoiceReference,
  createInvoiceSettlementProof,
  DuplicateSettlementProofError,
} from "@/lib/invoice-settlement/store";
import { readStoredSession, storeSession, type Session } from "@/lib/session";
import { createSubmissionGuard } from "@/lib/proofs/submission-guard";

export function InvoiceSettlementProofWizard() {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [connecting, setConnecting] = useState(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>(WIZARD_STEPS.REFERENCE_ENTRY);

  const [rawReference, setRawReference] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_VALUES.expiresInDays);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdProofId, setCreatedProofId] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const submissionGuard = useRef(createSubmissionGuard());

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;
    void Promise.resolve().then(async () => {
      try {
        const result = await apiClient<Payment[]>({
          path: "/payments",
          headers: bearer(session.token),
        });
        if (active) {
          setPayments(result);
        }
      } catch {
        if (active) {
          setError("Could not load payments. Try again.");
        }
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.token]);

  const normalizedReference = normalizeInvoiceReference(rawReference);

  const candidates: SettlementCandidate[] = useMemo(() => {
    if (!session || normalizedReference.length < 4) {
      return [];
    }

    return payments
      .filter((payment) => payment.isEligible && payment.classification === "INCOME")
      .map((payment) => ({
        paymentId: payment.id,
        assetCode: payment.assetCode,
        occurredAt: payment.occurredAt,
        isSupportedAsset: isSupportedAssetCode(payment.assetCode),
        alreadyBoundElsewhere: isReferenceBoundElsewhere(session.user.id, normalizedReference, payment.id),
      }));
  }, [session, payments, normalizedReference]);

  const matchOutcome = useMemo(
    () =>
      classifySettlementMatch(
        candidates.map(({ paymentId, assetCode, alreadyBoundElsewhere }) => ({
          paymentId,
          assetCode,
          alreadyBoundElsewhere,
        })),
      ),
    [candidates],
  );

  /**
   * When there is exactly one eligible candidate, it is selected by default
   * without requiring a manual click; an AMBIGUOUS outcome leaves selection
   * to the user via `selectedPaymentId`. Derived directly from
   * `matchOutcome` rather than synced through an effect, since it is a pure
   * function of already-rendered state.
   */
  const effectiveSelectedPaymentId =
    selectedPaymentId ?? (matchOutcome.kind === "MATCHED" ? matchOutcome.paymentId : null);

  const selectedPayment = payments.find((payment) => payment.id === effectiveSelectedPaymentId) ?? null;

  const canProceedToStep = (step: WizardStep): boolean => {
    switch (step) {
      case WIZARD_STEPS.REFERENCE_ENTRY:
        return invoiceReferenceSchema.safeParse(rawReference).success;
      case WIZARD_STEPS.SETTLEMENT_MATCH:
        return effectiveSelectedPaymentId !== null;
      case WIZARD_STEPS.CONFIRMATION:
        return true;
      default:
        return false;
    }
  };

  async function createProof() {
    if (!session || !selectedPayment) {
      setError("Select a matching settlement before creating the proof.");
      return;
    }

    const submissionId = submissionGuard.current.begin();
    if (submissionId === null) {
      return;
    }

    setError(null);
    setStatus("Creating invoice settlement proof...");

    try {
      bindInvoiceReference(session.user.id, normalizedReference, selectedPayment.id);
      const proof = createInvoiceSettlementProof(session.user.id, {
        paymentId: selectedPayment.id,
        normalizedInvoiceReference: normalizedReference,
        expiresInDays,
      });

      if (!submissionGuard.current.isCurrent(submissionId)) {
        return;
      }

      setCreatedProofId(proof.id);
      setStatus("Invoice settlement proof created.");
    } catch (err) {
      if (!submissionGuard.current.isCurrent(submissionId)) {
        return;
      }

      setStatus(null);
      setError(
        err instanceof DuplicateSettlementProofError
          ? err.message
          : "Proof creation failed. Please try again.",
      );
    } finally {
      submissionGuard.current.end(submissionId);
    }
  }

  async function connectWallet() {
    setError(null);
    setConnecting(true);
    setStatus("Requesting Freighter wallet access...");

    try {
      const freighter = await import("@stellar/freighter-api");
      const access = await freighter.requestAccess().catch(() => null);
      const walletAddress = access?.address ?? (await freighter.getAddress().catch(() => null))?.address ?? null;

      if (!walletAddress) {
        setStatus(null);
        setError("Freighter was not found or did not return a Stellar address.");
        return;
      }

      const challenge = await apiClient<{ id: string; message: string; expiresAt: string }>({
        path: "/auth/challenge",
        method: "POST",
        body: JSON.stringify({ walletAddress }),
      });

      setStatus("Waiting for wallet signature...");
      const signResponse = await freighter
        .signMessage(challenge.message, {
          networkPassphrase: appConfig.stellarNetworkPassphrase,
          address: walletAddress,
        })
        .catch(() => null);

      const signature =
        typeof signResponse?.signedMessage === "string"
          ? signResponse.signedMessage
          : signResponse?.signedMessage
            ? btoa(String.fromCharCode(...signResponse.signedMessage))
            : null;

      if (!signature) {
        setStatus(null);
        setError("Wallet did not return a signature for the challenge.");
        return;
      }

      const verified = await apiClient<{ user: Session["user"]; session: { token: string; tokenType: "Bearer" } }>({
        path: "/auth/verify",
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.id, walletAddress, signature }),
      });

      const newSession: Session = { token: verified.session.token, user: verified.user };
      storeSession(newSession);
      setSession(newSession);
      setStatus("Wallet authenticated.");
    } catch {
      setStatus(null);
      setError("Wallet connection failed. Check Freighter and try again.");
    } finally {
      setConnecting(false);
    }
  }

  const renderCurrentStep = () => {
    if (!session) {
      return (
        <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Connect your Stellar wallet to build an invoice-settlement proof.
          </p>
          <button
            type="button"
            onClick={connectWallet}
            disabled={connecting}
            className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
          >
            {connecting ? "Connecting..." : "Connect Freighter"}
          </button>
        </section>
      );
    }

    switch (currentStep) {
      case WIZARD_STEPS.REFERENCE_ENTRY:
        return (
          <InvoiceReferenceEntryStep
            rawReference={rawReference}
            onRawReferenceChange={(value) => {
              setRawReference(value);
              setSelectedPaymentId(null);
            }}
          />
        );
      case WIZARD_STEPS.SETTLEMENT_MATCH:
        return (
          <SettlementMatchStep
            candidates={candidates}
            selectedPaymentId={effectiveSelectedPaymentId}
            matchOutcome={matchOutcome}
            onSelectPayment={setSelectedPaymentId}
          />
        );
      case WIZARD_STEPS.CONFIRMATION:
        return (
          <InvoiceSettlementConfirmation
            normalizedInvoiceReference={normalizedReference}
            assetCode={selectedPayment?.assetCode ?? ""}
            occurredAt={selectedPayment?.occurredAt ?? ""}
            expiresInDays={expiresInDays}
            onExpiresInDaysChange={setExpiresInDays}
            onCreateProof={createProof}
            loading={!!status && !createdProofId}
            canSubmit={selectedPayment !== null}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-8 sm:gap-10">
      {session && (
        <GenericWizardSteps
          steps={STEP_ORDER}
          labels={STEP_LABELS}
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          canProceedToStep={canProceedToStep}
        />
      )}

      {renderCurrentStep()}

      {(status || error || createdProofId) && (
        <section className="rounded-lg border border-white/10 bg-slate-950 p-5 text-sm leading-6">
          {status && (
            <p aria-live="polite" className="text-slate-300">
              {status}
            </p>
          )}
          {error && (
            <p aria-live="assertive" className="text-rose-200 focus-visible:outline-none" ref={errorRef} role="alert" tabIndex={-1}>
              {error}
            </p>
          )}
          {createdProofId && (
            <p className="mt-2 text-slate-300">
              Proof ID: <span className="text-cyan-200">{createdProofId}</span>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
