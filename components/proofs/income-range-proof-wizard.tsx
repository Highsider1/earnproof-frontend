"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { getAddress, requestAccess, signMessage } from "@stellar/freighter-api";
import { WizardSteps } from "./wizard-steps";
import { IncomeRangeConfigStep } from "./income-range-config-step";
import { IncomeRangeDisclosurePreview } from "./income-range-disclosure-preview";
import { IncomeRangeProofConfirmation } from "./income-range-proof-confirmation";
import { ArtifactExport } from "./artifact-export";
import {
  createIncomeRangeProof,
  validateIncomeRange,
  type IncomeRangeProof,
} from "@/lib/api/income-range-proofs";
import { apiClient, bearer } from "@/lib/api/client";
import { appConfig } from "@/config/app";
import { buildCredentialExport, buildVerificationLinkExport } from "@/lib/credentials/export";
import { WIZARD_STEPS, STEP_ORDER, STEP_LABELS, DEFAULT_VALUES, type WizardStep } from "@/lib/validation/income-range-proofs";
import {
  readStoredSession,
  storeSession,
  clearStoredSession,
  type SessionUser,
} from "@/lib/session";
import { resolveIdempotencyKey, type IdempotencyState, type ProofIntent } from "@/lib/proofs/idempotency";
import { createSubmissionGuard } from "@/lib/proofs/submission-guard";
import { useDeploymentMetadataGate } from "@/lib/deployment/use-deployment-metadata-gate";
import { DeploymentMetadataWarning } from "@/components/common/deployment-metadata-warning";

type PaymentClassification =
  | "INCOME"
  | "REIMBURSEMENT"
  | "PERSONAL_TRANSFER"
  | "UNKNOWN"
  | "EXCLUDED";

type Payment = {
  id: string;
  stellarTransactionHash: string;
  sourceAddress: string;
  assetCode: string;
  assetIssuer: string | null;
  occurredAt: string;
  classification: PaymentClassification;
  isEligible: boolean;
};

export function IncomeRangeProofWizard() {
  const initialSession = useMemo(() => readStoredSession(), []);
  const [token, setToken] = useState<string | null>(() => initialSession?.token ?? null);
  const [user, setUser] = useState<SessionUser | null>(() => initialSession?.user ?? null);
  const [currentStep, setCurrentStep] = useState<WizardStep>(WIZARD_STEPS.RANGE_CONFIG);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);

  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [lowerBound, setLowerBound] = useState("100");
  const [upperBound, setUpperBound] = useState("500");
  const [periodStart, setPeriodStart] = useState("2026-08-01");
  const [periodEnd, setPeriodEnd] = useState("2026-08-31");
  const [expiresInDays, setExpiresInDays] = useState<number>(DEFAULT_VALUES.expiresInDays);

  const [proof, setProof] = useState<IncomeRangeProof | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingProof, setIsSubmittingProof] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const wasConnectedRef = useRef(Boolean(initialSession?.user));
  const submissionGuardRef = useRef(createSubmissionGuard());
  const idempotencyRef = useRef<IdempotencyState | null>(null);
  const deploymentMetadataGate = useDeploymentMetadataGate();

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  useEffect(() => {
    if (user) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      wasConnectedRef.current = false;
      connectButtonRef.current?.focus();
    }
  }, [user]);

  const selectedIncomePayments = useMemo(
    () =>
      payments.filter(
        (payment) =>
          selectedPaymentIds.includes(payment.id) &&
          payment.classification === "INCOME" &&
          payment.isEligible,
      ),
    [payments, selectedPaymentIds],
  );

  const selectedAssetCode = selectedIncomePayments[0]?.assetCode ?? null;
  const selectedAssetIssuer = selectedIncomePayments[0]?.assetIssuer ?? null;

  async function connectWallet() {
    setError(null);
    setStatus("Verifying deployment configuration...");

    // #185: deployment metadata must be verified before requesting a wallet
    // signature, so a compromised or misconfigured deployment is caught
    // before the user is ever asked to sign anything.
    const verification = await deploymentMetadataGate.runIfVerified(async () => {
      setStatus("Requesting Freighter wallet access...");

      const walletAddress = await getFreighterAddress();
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
      const signature = await signFreighterMessage(challenge.message, walletAddress);
      if (!signature) {
        setStatus(null);
        setError("Wallet did not return a signature for the challenge.");
        return;
      }

      const verified = await apiClient<{
        user: SessionUser;
        session: { token: string; tokenType: "Bearer" };
      }>({
        path: "/auth/verify",
        method: "POST",
        body: JSON.stringify({ challengeId: challenge.id, walletAddress, signature }),
      });

      storeSession({ token: verified.session.token, user: verified.user });
      setToken(verified.session.token);
      setUser(verified.user);
      setStatus("Wallet authenticated.");
    }).catch(() => {
      setStatus(null);
      setError("Wallet connection failed. Check Freighter and try again.");
      return null;
    });

    if (verification && verification.status !== "valid") {
      setStatus(null);
    }
  }

  async function syncPayments() {
    if (!token) {
      return;
    }

    setError(null);
    setStatus("Syncing incoming Stellar testnet payments...");
    setPaymentsLoading(true);

    try {
      await apiClient({ path: "/payments/sync", method: "POST", headers: bearer(token) });
      await refreshPayments(token);
      setStatus("Payments synced.");
    } catch {
      setStatus(null);
      setError("Payment sync failed. Try again.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function refreshPayments(activeToken = token) {
    if (!activeToken) {
      return;
    }

    setPaymentsLoading(true);
    try {
      const response = await apiClient<Payment[]>({ path: "/payments", headers: bearer(activeToken) });
      setPayments(response);
    } catch {
      setError("Could not load payments. Try again.");
    } finally {
      setPaymentsLoading(false);
    }
  }

  async function createProof() {
    if (!token || !selectedAssetCode || selectedIncomePayments.length === 0) {
      setError("Select at least one eligible income payment before creating the proof.");
      return;
    }

    const rangeError = validateIncomeRange(lowerBound, upperBound);
    if (rangeError) {
      setError(rangeError);
      return;
    }

    const submissionId = submissionGuardRef.current.begin();
    if (submissionId === null) {
      return;
    }

    setIsSubmittingProof(true);
    setError(null);
    setProof(null);
    setStatus("Creating income-range proof...");

    const intent: ProofIntent = {
      selectedPaymentIds: selectedIncomePayments.map((payment) => payment.id),
      lowerBound,
      upperBound,
      assetCode: selectedAssetCode,
      assetIssuer: selectedAssetIssuer ?? undefined,
      periodStart: `${periodStart}T00:00:00.000Z`,
      periodEnd: `${periodEnd}T23:59:59.000Z`,
    };
    const idempotency = resolveIdempotencyKey(idempotencyRef.current, intent);
    idempotencyRef.current = idempotency;

    try {
      const controller = new AbortController();
      const created = await createIncomeRangeProof(
        token,
        {
          selectedPaymentIds: selectedIncomePayments.map((payment) => payment.id),
          lowerBound,
          upperBound,
          assetCode: selectedAssetCode,
          assetIssuer: selectedAssetIssuer ?? undefined,
          periodStart: `${periodStart}T00:00:00.000Z`,
          periodEnd: `${periodEnd}T23:59:59.000Z`,
          expiresInDays,
        },
        controller.signal,
        idempotency.key,
      );

      if (!submissionGuardRef.current.isCurrent(submissionId)) {
        return;
      }

      setProof(created);
      setStatus("Income-range proof created.");
      idempotencyRef.current = null;
    } catch {
      if (!submissionGuardRef.current.isCurrent(submissionId)) {
        return;
      }
      setStatus(null);
      setError("Proof creation failed. Check the selected range and try again.");
    } finally {
      submissionGuardRef.current.end(submissionId);
      setIsSubmittingProof(false);
    }
  }

  function disconnect() {
    submissionGuardRef.current.invalidate();
    idempotencyRef.current = null;
    setIsSubmittingProof(false);
    clearStoredSession();
    setToken(null);
    setUser(null);
    setPayments([]);
    setSelectedPaymentIds([]);
    setProof(null);
    setStatus(null);
    setError(null);
    setCurrentStep(WIZARD_STEPS.RANGE_CONFIG);
  }

  const canProceedToNextStep = (step: WizardStep): boolean => {
    switch (step) {
      case WIZARD_STEPS.RANGE_CONFIG:
        return (
          selectedIncomePayments.length > 0 &&
          validateIncomeRange(lowerBound, upperBound) === null &&
          !!periodStart &&
          !!periodEnd &&
          new Date(periodStart) < new Date(periodEnd)
        );
      case WIZARD_STEPS.DISCLOSURE_PREVIEW:
        return true;
      case WIZARD_STEPS.CONFIRMATION:
        return true;
      default:
        return false;
    }
  };

  const renderCurrentStep = () => {
    if (!user) {
      return (
        <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div>
            <h2 className="text-xl font-semibold text-white">Wallet Connection Required</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Connect your Stellar testnet wallet to access the income-range proof wizard.
            </p>
          </div>
          {deploymentMetadataGate.state && (
            <DeploymentMetadataWarning state={deploymentMetadataGate.state} />
          )}
          <button
            className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={connectWallet}
            disabled={deploymentMetadataGate.isChecking}
            ref={connectButtonRef}
            type="button"
          >
            {deploymentMetadataGate.isChecking ? "Verifying..." : "Connect Freighter"}
          </button>
        </section>
      );
    }

    switch (currentStep) {
      case WIZARD_STEPS.RANGE_CONFIG:
        return (
          <IncomeRangeConfigStep
            payments={payments}
            selectedPaymentIds={selectedPaymentIds}
            lowerBound={lowerBound}
            upperBound={upperBound}
            periodStart={periodStart}
            periodEnd={periodEnd}
            onPaymentSelectionChange={setSelectedPaymentIds}
            onLowerBoundChange={setLowerBound}
            onUpperBoundChange={setUpperBound}
            onPeriodStartChange={setPeriodStart}
            onPeriodEndChange={setPeriodEnd}
            onSyncPayments={syncPayments}
            onRefreshPayments={() => refreshPayments()}
            loading={paymentsLoading}
          />
        );
      case WIZARD_STEPS.DISCLOSURE_PREVIEW:
        return (
          <IncomeRangeDisclosurePreview
            lowerBound={lowerBound}
            upperBound={upperBound}
            assetCode={selectedAssetCode}
            periodStart={periodStart}
            periodEnd={periodEnd}
            qualifyingPaymentCount={selectedIncomePayments.length}
          />
        );
      case WIZARD_STEPS.CONFIRMATION:
        return (
          <IncomeRangeProofConfirmation
            lowerBound={lowerBound}
            upperBound={upperBound}
            assetCode={selectedAssetCode}
            periodStart={periodStart}
            periodEnd={periodEnd}
            qualifyingPaymentCount={selectedIncomePayments.length}
            expiresInDays={expiresInDays}
            onExpiresInDaysChange={setExpiresInDays}
            onCreateProof={createProof}
            loading={isSubmittingProof}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-8 sm:gap-10">
      {user && (
        <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-sm text-slate-300">
                Connected as{" "}
                <span className="text-cyan-200 font-mono">
                  {user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-8)}
                </span>
              </span>
            </div>
            <button className="text-xs text-slate-400 hover:text-slate-300 transition" onClick={disconnect} type="button">
              Disconnect
            </button>
          </div>
        </section>
      )}

      <WizardSteps
        stepOrder={STEP_ORDER}
        stepLabels={STEP_LABELS}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        canProceedToStep={canProceedToNextStep}
      />

      {renderCurrentStep()}

      {(status || error || proof) && (
        <section className="rounded-lg border border-white/10 bg-slate-950 p-5 text-sm leading-6" id="income-range-wizard-feedback">
          {status && (
            <p aria-live="polite" className="text-slate-300">
              {status}
            </p>
          )}
          {error && (
            <p
              aria-live="assertive"
              className="text-rose-200 focus-visible:outline-none"
              ref={errorRef}
              role="alert"
              tabIndex={-1}
            >
              {error}
            </p>
          )}
          {proof && (
            <div className="mt-4 grid gap-2 text-slate-300">
              <p>
                Proof ID: <span className="text-cyan-200">{proof.proofId}</span>
              </p>
              <p className="break-words">
                Credential hash: <span className="text-cyan-200">{proof.credential.proof.credentialHash}</span>
              </p>
              <a
                className="w-fit text-cyan-200 underline underline-offset-4"
                href={`/verify?proof=${encodeURIComponent(proof.proofId)}`}
              >
                Open public verification
              </a>
              <ArtifactExport plan={buildVerificationLinkExport(proof.verificationUrl)} title="Export verification link" />
              <ArtifactExport plan={buildCredentialExport({ credential: proof.credential })} title="Export credential JSON" />
            </div>
          )}
        </section>
      )}
    </div>
  );
}

async function loadFreighter(): Promise<{
  getAddress: typeof getAddress;
  requestAccess: typeof requestAccess;
  signMessage: typeof signMessage;
}> {
  return import("@stellar/freighter-api");
}

async function getFreighterAddress() {
  const freighter = await loadFreighter();
  const access = await freighter.requestAccess().catch(() => null);
  if (access?.address) {
    return access.address;
  }

  const address = await freighter.getAddress().catch(() => null);
  return address?.address ?? null;
}

async function signFreighterMessage(message: string, walletAddress: string) {
  const freighter = await loadFreighter();
  const response = await freighter
    .signMessage(message, {
      networkPassphrase: appConfig.stellarNetworkPassphrase,
      address: walletAddress,
    })
    .catch(() => null);

  if (!response?.signedMessage) {
    return null;
  }

  if (typeof response.signedMessage === "string") {
    return response.signedMessage;
  }

  return bytesToBase64(response.signedMessage);
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
