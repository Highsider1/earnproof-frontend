"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GenericWizardSteps } from "./generic-wizard-steps";
import { ContinuityConfigStep } from "./continuity-config-step";
import { EmploymentPeriodConfigStep } from "./employment-period-config-step";
import { CoverageReviewStep, type PeriodCoverageEntry } from "./coverage-review-step";
import { EmploymentContinuityConfirmation } from "./employment-continuity-confirmation";
import { apiClient, bearer } from "@/lib/api/client";
import { appConfig } from "@/config/app";
import type { Payment } from "@/lib/api/generated/v1";
import {
  WIZARD_STEPS,
  STEP_ORDER,
  STEP_LABELS,
  DEFAULT_VALUES,
  buildMonthlyPeriods,
  type WizardStep,
  type GapPolicy,
} from "@/lib/validation/employment-continuity-proofs";
import { createEmploymentContinuityProof } from "@/lib/employment-continuity/store";
import { readStoredSession, storeSession, type Session } from "@/lib/session";

export function EmploymentContinuityProofWizard() {
  const [session, setSession] = useState<Session | null>(() => readStoredSession());
  const [currentStep, setCurrentStep] = useState<WizardStep>(WIZARD_STEPS.CONTINUITY_CONFIG);
  const [connecting, setConnecting] = useState(false);

  const [continuityLengthMonths, setContinuityLengthMonths] = useState(DEFAULT_VALUES.continuityLengthMonths);
  const [gapPolicy, setGapPolicy] = useState<GapPolicy>(DEFAULT_VALUES.gapPolicy);
  const [periodStart, setPeriodStart] = useState("2026-06-01");
  const [periodEnd, setPeriodEnd] = useState("2026-09-01");
  const [assetCode, setAssetCode] = useState("");
  const [assetIssuer, setAssetIssuer] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(DEFAULT_VALUES.expiresInDays);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdProofId, setCreatedProofId] = useState<string | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);

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

  const periods = useMemo(() => buildMonthlyPeriods(periodStart, periodEnd), [periodStart, periodEnd]);

  const periodCoverage: PeriodCoverageEntry[] = useMemo(() => {
    return periods.map((period) => {
      const qualifyingPayments = payments.filter(
        (payment) =>
          payment.isEligible &&
          payment.classification === "INCOME" &&
          (!assetCode || payment.assetCode === assetCode) &&
          payment.occurredAt >= period.start &&
          payment.occurredAt < period.end,
      );

      return {
        start: period.start,
        end: period.end,
        covered: qualifyingPayments.length > 0,
        qualifyingPaymentCount: qualifyingPayments.length,
      };
    });
  }, [periods, payments, assetCode]);

  const canProceedToStep = (step: WizardStep): boolean => {
    switch (step) {
      case WIZARD_STEPS.CONTINUITY_CONFIG:
        return continuityLengthMonths >= 1 && continuityLengthMonths <= 60;
      case WIZARD_STEPS.PERIOD_CONFIG:
        return !!periodStart && !!periodEnd && new Date(periodStart) < new Date(periodEnd);
      case WIZARD_STEPS.COVERAGE_REVIEW:
        return periods.length > 0 && assetCode.trim().length > 0;
      case WIZARD_STEPS.CONFIRMATION:
        return true;
      default:
        return false;
    }
  };

  function createProof() {
    if (!session) {
      setError("Sign in to create a proof.");
      return;
    }

    if (periods.length === 0 || !assetCode.trim()) {
      setError("Complete the previous steps before creating the proof.");
      return;
    }

    setError(null);
    setStatus("Creating employment continuity proof...");

    const missingPeriods = periodCoverage.filter((period) => !period.covered).map(({ start, end }) => ({ start, end }));
    const coveredPeriods = periodCoverage.length - missingPeriods.length;

    try {
      const proof = createEmploymentContinuityProof(session.user.id, {
        continuityLengthMonths,
        gapPolicy,
        periodStart: new Date(periodStart).toISOString(),
        periodEnd: new Date(periodEnd).toISOString(),
        assetCode: assetCode.trim(),
        assetIssuer: assetIssuer.trim() || null,
        totalPeriods: periodCoverage.length,
        coveredPeriods,
        missingPeriods,
        expiresInDays,
      });

      setCreatedProofId(proof.id);
      setStatus("Employment continuity proof created.");
    } catch {
      setStatus(null);
      setError("Proof creation failed. Please try again.");
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
            Connect your Stellar wallet to build an employment-continuity proof.
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
      case WIZARD_STEPS.CONTINUITY_CONFIG:
        return (
          <ContinuityConfigStep
            continuityLengthMonths={continuityLengthMonths}
            gapPolicy={gapPolicy}
            onContinuityLengthMonthsChange={setContinuityLengthMonths}
            onGapPolicyChange={setGapPolicy}
          />
        );
      case WIZARD_STEPS.PERIOD_CONFIG:
        return (
          <EmploymentPeriodConfigStep
            periodStart={periodStart}
            periodEnd={periodEnd}
            continuityLengthMonths={continuityLengthMonths}
            onPeriodStartChange={setPeriodStart}
            onPeriodEndChange={setPeriodEnd}
          />
        );
      case WIZARD_STEPS.COVERAGE_REVIEW:
        return (
          <CoverageReviewStep
            periods={periodCoverage}
            gapPolicy={gapPolicy}
            assetCode={assetCode}
            assetIssuer={assetIssuer}
            onAssetCodeChange={setAssetCode}
            onAssetIssuerChange={setAssetIssuer}
          />
        );
      case WIZARD_STEPS.CONFIRMATION:
        return (
          <EmploymentContinuityConfirmation
            continuityLengthMonths={continuityLengthMonths}
            gapPolicy={gapPolicy}
            periodStart={periodStart}
            periodEnd={periodEnd}
            assetCode={assetCode}
            totalPeriods={periodCoverage.length}
            coveredPeriods={periodCoverage.filter((period) => period.covered).length}
            expiresInDays={expiresInDays}
            onExpiresInDaysChange={setExpiresInDays}
            onCreateProof={createProof}
            loading={!!status && !createdProofId}
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
