"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WizardSteps } from "./wizard-steps";
import { IntervalConfigStep } from "./interval-config-step";
import { PeriodConfigStep } from "./period-config-step";
import { RecurringPaymentSelection } from "./recurring-payment-selection";
import { CoverageAnalysisStep } from "./coverage-analysis-step";
import { RecurringProofConfirmation } from "./recurring-proof-confirmation";
import { ArtifactExport } from "./artifact-export";
import { Redacted } from "@/components/common/redacted";
import { usePrivacy } from "@/contexts/privacy-context";
import { createRecurringIncomeProof, analyzeIntervalCoverage, type RecurringIncomeProof, type IntervalUnit, type IntervalCoverageAnalysis } from "@/lib/api/recurring-income-proofs";
import { apiClient, bearer } from "@/lib/api/client";
import { appConfig } from "@/config/app";
import { buildCredentialExport, buildVerificationLinkExport } from "@/lib/credentials/export";
import { WIZARD_STEPS, STEP_ORDER, STEP_LABELS, DEFAULT_VALUES, type WizardStep } from "@/lib/validation/recurring-income-proofs";
import { NetworkMismatchAlert } from "@/components/wallet/network-mismatch-alert";
import {
  isSigningAllowed,
  validateNetworkCompatibility,
} from "@/lib/wallet/network-compatibility";
import type {
  NetworkCompatibilityCheckResult,
  WalletNetworkContext,
} from "@/lib/wallet/types";
import {
  readStoredSession,
  storeSession,
  clearStoredSession,
  type SessionUser,
} from "@/lib/session";
import { resolveIdempotencyKey, type IdempotencyState, type ProofIntent } from "@/lib/proofs/idempotency";
import { createSubmissionGuard } from "@/lib/proofs/submission-guard";
import {
  saveProofDraft,
  loadProofDraft,
  deleteProofDraft,
  type RecurringIncomeDraftData,
} from "@/lib/storage/proof-drafts";
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

export function RecurringIncomeProofWizard() {
  const initialSession = useMemo(() => readStoredSession(), []);
  
  // Load saved draft on mount (only non-secret fields)
  const savedDraft = useMemo(() => loadProofDraft<RecurringIncomeDraftData>('recurring-income'), []);
  
  const [token, setToken] = useState<string | null>(
    () => initialSession?.token ?? null,
  );
  const [user, setUser] = useState<SessionUser | null>(
    () => initialSession?.user ?? null,
  );
  const [currentStep, setCurrentStep] = useState<WizardStep>(() => (savedDraft?.currentStep as WizardStep) ?? WIZARD_STEPS.INTERVAL_CONFIG);
  const [payments, setPayments] = useState<Payment[]>([]);
  
  // Wizard state (restored from draft if available)
  const [intervalUnit, setIntervalUnit] = useState<IntervalUnit>(() => savedDraft?.intervalUnit ?? DEFAULT_VALUES.intervalUnit);
  const [intervalCount, setIntervalCount] = useState<number>(() => savedDraft?.intervalCount ?? DEFAULT_VALUES.intervalCount);
  const [periodStart, setPeriodStart] = useState(() => savedDraft?.periodStart ?? "2026-08-01");
  const [periodEnd, setPeriodEnd] = useState(() => savedDraft?.periodEnd ?? "2026-11-30");
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>(() => savedDraft?.selectedPaymentIds ?? []);
  const [selectedAsset, setSelectedAsset] = useState<{ code: string; issuer: string | null } | null>(() => savedDraft?.selectedAsset ?? null);
  const [expiresInDays, setExpiresInDays] = useState<number>(() => savedDraft?.expiresInDays ?? DEFAULT_VALUES.expiresInDays);
  
  // Analysis and results
  const [coverageAnalysis, setCoverageAnalysis] = useState<IntervalCoverageAnalysis | null>(null);
  const [proof, setProof] = useState<RecurringIncomeProof | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [networkCompatibility, setNetworkCompatibility] =
    useState<NetworkCompatibilityCheckResult | null>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const networkAlertRef = useRef<HTMLDivElement>(null);
  const connectButtonRef = useRef<HTMLButtonElement>(null);
  const wasConnectedRef = useRef(Boolean(initialSession?.user));
  const { isRedacted } = usePrivacy();

  useEffect(() => {
    if (error) {
      errorRef.current?.focus();
    }
  }, [error]);

  // Focus network alert when mismatch is detected so keyboard/screen-reader
  // users are alerted to the issue immediately.
  useEffect(() => {
    if (networkCompatibility && !networkCompatibility.isValid) {
      networkAlertRef.current?.focus();
    }
  }, [networkCompatibility]);

  // Restore focus to the "Connect Freighter" button after disconnecting
  useEffect(() => {
    if (user) {
      wasConnectedRef.current = true;
    } else if (wasConnectedRef.current) {
      wasConnectedRef.current = false;
      connectButtonRef.current?.focus();
    }
  }, [user]);

  // Save draft whenever form values change (only non-secret fields)
  useEffect(() => {
    const hasChanges = 
      intervalUnit !== DEFAULT_VALUES.intervalUnit ||
      intervalCount !== DEFAULT_VALUES.intervalCount ||
      periodStart !== "2026-08-01" ||
      periodEnd !== "2026-11-30" ||
      selectedPaymentIds.length > 0 ||
      selectedAsset !== null ||
      expiresInDays !== DEFAULT_VALUES.expiresInDays ||
      currentStep !== WIZARD_STEPS.INTERVAL_CONFIG;

    if (hasChanges) {
      const draftData: RecurringIncomeDraftData = {
        intervalUnit,
        intervalCount,
        periodStart,
        periodEnd,
        selectedPaymentIds,
        selectedAsset,
        expiresInDays,
        currentStep,
      };
      saveProofDraft('recurring-income', draftData);
    }
  }, [intervalUnit, intervalCount, periodStart, periodEnd, selectedPaymentIds, selectedAsset, expiresInDays, currentStep]);

  const eligibleIncomePayments = useMemo(
    () => payments.filter(p => 
      p.isEligible && 
      p.classification === "INCOME" &&
      (!selectedAsset || (p.assetCode === selectedAsset.code && p.assetIssuer === selectedAsset.issuer))
    ),
    [payments, selectedAsset]
  );

  const availableAssets = useMemo(() => {
    const assets = new Map<string, { code: string; issuer: string | null }>();
    
    payments
      .filter(p => p.isEligible && p.classification === "INCOME")
      .forEach(p => {
        const key = `${p.assetCode}:${p.assetIssuer || 'native'}`;
        assets.set(key, { code: p.assetCode, issuer: p.assetIssuer });
      });
    
    return Array.from(assets.values());
  }, [payments]);

  async function connectWallet() {
    setError(null);
    setNetworkCompatibility(null);
    setStatus("Verifying deployment configuration...");

    // #185: deployment metadata must be verified before requesting a wallet
    // signature, so a compromised or misconfigured deployment is caught
    // before the user is ever asked to sign anything.
    const verification = await deploymentMetadataGate.runIfVerified(async () => {
      setStatus("Requesting Freighter wallet access...");

      try {
        const walletAddress = await getFreighterAddress();
        if (!walletAddress) {
          setStatus(null);
          setError("Freighter was not found or did not return a Stellar address.");
          return;
        }

        // Detect wallet network context (may not be available in older wallet versions).
        const walletNetworkContext = await detectWalletNetworkContext();

        // Validate wallet network compatibility before proceeding with auth.
        const compatibility = validateNetworkCompatibility(walletNetworkContext);
        setNetworkCompatibility(compatibility);

        // If network compatibility is unknown, proceed anyway during auth - the backend
        // will validate the signature is correct for this network.
        // Only block if explicitly incompatible (confirmed wrong network).
        if (compatibility.state === "incompatible") {
          setStatus(null);
          return;
        }

        const challenge = await apiClient<{
          id: string;
          message: string;
          expiresAt: string;
        }>({
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
          body: JSON.stringify({
            challengeId: challenge.id,
            walletAddress,
            signature,
          }),
        });

        storeSession({ token: verified.session.token, user: verified.user });
        setToken(verified.session.token);
        setUser(verified.user);
        setStatus("Wallet authenticated.");
        // Clear network compatibility error after successful auth - the backend validated it
        setNetworkCompatibility(null);
      } catch {
        setStatus(null);
        setError("Wallet connection failed. Check Freighter and try again.");
      }
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

    try {
      await apiClient({
        path: "/payments/sync",
        method: "POST",
        headers: bearer(token),
      });
      await refreshPayments(token);
      setStatus("Payments synced.");
    } catch {
      setStatus(null);
      setError("Payment sync failed. Try again.");
    }
  }

  async function refreshPayments(activeToken = token) {
    if (!activeToken) {
      return;
    }

    try {
      const response = await apiClient<Payment[]>({
        path: "/payments",
        headers: bearer(activeToken),
      });
      setPayments(response);
    } catch {
      setError("Could not load payments. Try again.");
    }
  }

  const analyzeCoverage = useCallback(async () => {
    if (!token || selectedPaymentIds.length === 0) {
      return;
    }

    setError(null);
    setStatus("Analyzing interval coverage...");

    try {
      const controller = new AbortController();
      const analysis = await analyzeIntervalCoverage(token, {
        paymentIds: selectedPaymentIds,
        intervalUnit,
        intervalCount,
        periodStart: `${periodStart}T00:00:00.000Z`,
        periodEnd: `${periodEnd}T23:59:59.000Z`,
      }, controller.signal);
      
      setCoverageAnalysis(analysis);
      setStatus("Coverage analysis complete.");
    } catch {
      setStatus(null);
      setError("Coverage analysis failed. Please try again.");
    }
  }, [token, selectedPaymentIds, intervalUnit, intervalCount, periodStart, periodEnd]);

  async function createProof() {
    if (!token || !selectedAsset || selectedPaymentIds.length === 0) {
      setError("Please complete all wizard steps before creating the proof.");
      return;
    }

    // Verify network compatibility before attempting to sign.
    if (networkCompatibility && !isSigningAllowed(networkCompatibility.state)) {
      setError(null);
      return;
    }

    // Reject a re-entrant call (a second click before the button's disabled
    // state has re-rendered) instead of starting a second mutation. Only
    // one submission may be active for this wizard at a time.
    const submissionId = submissionGuardRef.current.begin();
    if (submissionId === null) {
      return;
    }

    setError(null);
    setProof(null);
    setStatus("Creating recurring income proof...");

    const intent: ProofIntent = {
      selectedPaymentIds,
      intervalUnit,
      intervalCount,
      periodStart: `${periodStart}T00:00:00.000Z`,
      periodEnd: `${periodEnd}T23:59:59.000Z`,
      assetCode: selectedAsset.code,
      assetIssuer: selectedAsset.issuer || undefined,
    };
    // A retry of the same intent (same selection, interval, period, and
    // asset) reuses the previous idempotency key; anything else mints a new
    // one. See lib/proofs/idempotency.ts.
    const idempotency = resolveIdempotencyKey(idempotencyRef.current, intent);
    idempotencyRef.current = idempotency;

    try {
      const controller = new AbortController();
      const created = await createRecurringIncomeProof(token, {
        selectedPaymentIds,
        intervalUnit,
        intervalCount,
        periodStart: `${periodStart}T00:00:00.000Z`,
        periodEnd: `${periodEnd}T23:59:59.000Z`,
        assetCode: selectedAsset.code,
        assetIssuer: selectedAsset.issuer || undefined,
        expiresInDays,
      }, controller.signal, idempotency.key);

      // Drop this response if something (a wallet disconnect, most likely)
      // invalidated this submission while the request was in flight.
      if (!submissionGuardRef.current.isCurrent(submissionId)) {
        return;
      }

      setProof(created);
      setStatus("Recurring income proof created.");
      // The intent this key covered has now succeeded; a future click,
      // even with identical field values, is a new intent and should get
      // its own key rather than silently reusing a completed one.
      idempotencyRef.current = null;
      // Clear draft after successful proof creation
      deleteProofDraft('recurring-income');
    } catch {
      if (!submissionGuardRef.current.isCurrent(submissionId)) {
        return;
      }
      setStatus(null);
      setError("Proof creation failed. Please verify your configuration and try again.");
    } finally {
      submissionGuardRef.current.end(submissionId);
    }
  }

  function disconnect() {
    // Any proof-creation request still in flight belongs to a session that
    // no longer exists once the wallet is disconnected; invalidate it so
    // its eventual response can't resurrect proof/error state, and so a
    // fresh submit isn't stuck waiting on a request that may never resolve.
    submissionGuardRef.current.invalidate();
    idempotencyRef.current = null;
    clearStoredSession();
    setToken(null);
    setUser(null);
    setPayments([]);
    setSelectedPaymentIds([]);
    setSelectedAsset(null);
    setCoverageAnalysis(null);
    setProof(null);
    setStatus(null);
    setError(null);
    setNetworkCompatibility(null);
    setCurrentStep(WIZARD_STEPS.INTERVAL_CONFIG);
  }

  function discardDraft() {
    deleteProofDraft('recurring-income');
    setIntervalUnit(DEFAULT_VALUES.intervalUnit);
    setIntervalCount(DEFAULT_VALUES.intervalCount);
    setPeriodStart("2026-08-01");
    setPeriodEnd("2026-11-30");
    setSelectedPaymentIds([]);
    setSelectedAsset(null);
    setExpiresInDays(DEFAULT_VALUES.expiresInDays);
    setCurrentStep(WIZARD_STEPS.INTERVAL_CONFIG);
    setCoverageAnalysis(null);
    setStatus("Draft discarded.");
  }

  const canProceedToNextStep = (step: WizardStep): boolean => {
    switch (step) {
      case WIZARD_STEPS.INTERVAL_CONFIG:
        return intervalUnit !== undefined && intervalCount > 0;
      case WIZARD_STEPS.PERIOD_CONFIG:
        return !!periodStart && !!periodEnd && new Date(periodStart) < new Date(periodEnd);
      case WIZARD_STEPS.PAYMENT_SELECTION:
        return selectedPaymentIds.length > 0 && selectedAsset !== null;
      case WIZARD_STEPS.COVERAGE_ANALYSIS:
        return coverageAnalysis !== null;
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
              Connect your Stellar testnet wallet to access the recurring income proof wizard.
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
      case WIZARD_STEPS.INTERVAL_CONFIG:
        return (
          <IntervalConfigStep
            intervalUnit={intervalUnit}
            intervalCount={intervalCount}
            onIntervalUnitChange={setIntervalUnit}
            onIntervalCountChange={setIntervalCount}
          />
        );
      case WIZARD_STEPS.PERIOD_CONFIG:
        return (
          <PeriodConfigStep
            periodStart={periodStart}
            periodEnd={periodEnd}
            intervalUnit={intervalUnit}
            intervalCount={intervalCount}
            onPeriodStartChange={setPeriodStart}
            onPeriodEndChange={setPeriodEnd}
          />
        );
      case WIZARD_STEPS.PAYMENT_SELECTION:
        return (
          <RecurringPaymentSelection
            payments={eligibleIncomePayments}
            availableAssets={availableAssets}
            selectedPaymentIds={selectedPaymentIds}
            selectedAsset={selectedAsset}
            onPaymentSelection={setSelectedPaymentIds}
            onAssetSelection={setSelectedAsset}
            onSyncPayments={syncPayments}
            onRefreshPayments={() => refreshPayments()}
            loading={!token}
          />
        );
      case WIZARD_STEPS.COVERAGE_ANALYSIS:
        return (
          <CoverageAnalysisStep
            intervalUnit={intervalUnit}
            intervalCount={intervalCount}
            periodStart={periodStart}
            periodEnd={periodEnd}
            selectedPaymentIds={selectedPaymentIds}
            coverageAnalysis={coverageAnalysis}
            onAnalyzeCoverage={analyzeCoverage}
            loading={!!status}
          />
        );
      case WIZARD_STEPS.CONFIRMATION:
        return (
          <RecurringProofConfirmation
            intervalUnit={intervalUnit}
            intervalCount={intervalCount}
            periodStart={periodStart}
            periodEnd={periodEnd}
            selectedAsset={selectedAsset}
            selectedPaymentCount={selectedPaymentIds.length}
            coverageAnalysis={coverageAnalysis}
            expiresInDays={expiresInDays}
            onExpiresInDaysChange={setExpiresInDays}
            onCreateProof={createProof}
            loading={!!status}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="grid gap-8 sm:gap-10">
      {/* Wallet Status */}
      {user && (
        <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
              <span className="text-sm text-slate-300">
                Connected as <span className="text-cyan-200 font-mono"><Redacted>{user.walletAddress.slice(0, 8)}...{user.walletAddress.slice(-8)}</Redacted></span>
              </span>
            </div>
            <div className="flex gap-2">
              {savedDraft && (
                <button
                  className="text-xs text-slate-400 hover:text-slate-300 transition"
                  onClick={discardDraft}
                  type="button"
                >
                  Discard Draft
                </button>
              )}
              <button
                className="text-xs text-slate-400 hover:text-slate-300 transition"
                onClick={disconnect}
                type="button"
              >
                Disconnect
              </button>
            </div>
          </div>
          {networkCompatibility && !networkCompatibility.isValid && (
            <NetworkMismatchAlert
              result={networkCompatibility}
              forwardRef={networkAlertRef}
            />
          )}
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

      {/* Status and Results */}
      {(status || error || proof) && (
        <section
          className="rounded-lg border border-white/10 bg-slate-950 p-5 text-sm leading-6"
          id="wizard-feedback"
        >
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
                Proof ID: <span className="text-cyan-200"><Redacted>{proof.proofId}</Redacted></span>
              </p>
              <p className="break-words">
                Credential hash:{" "}
                <span className="text-cyan-200">
                  <Redacted>{proof.credential.proof.credentialHash}</Redacted>
                </span>
              </p>
              {!isRedacted && (
                <>
                  <a
                    className="w-fit text-cyan-200 underline underline-offset-4"
                    href={`/verify?proof=${encodeURIComponent(proof.proofId)}`}
                  >
                    Open public verification
                  </a>
                  <ArtifactExport
                    plan={buildVerificationLinkExport(proof.verificationUrl)}
                    title="Export verification link"
                  />
                  <ArtifactExport
                    plan={buildCredentialExport({
                      credential: proof.credential,
                    })}
                    title="Export credential JSON"
                  />
                </>
              )}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

// Import Freighter wallet functions (same as in other proof flows)
async function loadFreighter(): Promise<typeof import("@stellar/freighter-api")> {
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

/**
 * Detect wallet network context from Freighter.
 *
 * Freighter v5+ may report network information in the signMessage response.
 * Earlier versions do not expose this metadata. Returns an empty context object
 * if network detection fails or is not supported.
 */
async function detectWalletNetworkContext(): Promise<WalletNetworkContext> {
  return {};
}

function bytesToBase64(value: Uint8Array) {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}
