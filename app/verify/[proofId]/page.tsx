"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { ProofLifecycleTimeline } from "@/components/proofs/proof-lifecycle-timeline";
import { Timestamp } from "@/components/common/timestamp";
import { PrintableProofSummary } from "@/components/verification/printable-proof-summary";
import { ProvenianceChainDisplay } from "@/components/verification/provenance-chain-display";
import { useProofStatusPolling } from "@/lib/proof-status-polling";
import { hasProvenance } from "@/lib/proofs/provenance-chain";
import { formatDateRange, formatMessage } from "@/lib/i18n";
import type { VerifyProofResponse } from "@/lib/api/generated/v1";

interface VerificationPurpose {
  id: string;
  label: string;
  description: string;
  disclosures: string[];
}

const APPROVED_PURPOSES: VerificationPurpose[] = [
  {
    id: "employment-screening",
    label: "Employment screening",
    description: "Confirm minimum income for a job offer.",
    disclosures: [
      "Qualifying payment count",
      "Minimum income threshold",
      "Verification period",
      "Proof validity status"
    ]
  },
  {
    id: "rental-application",
    label: "Rental application",
    description: "Confirm minimum income for a lease application.",
    disclosures: [
      "Minimum income threshold",
      "Verification period",
      "Proof validity status"
    ]
  },
  {
    id: "credit-assessment",
    label: "Credit assessment",
    description: "Confirm minimum income for a credit assessment.",
    disclosures: [
      "Qualifying payment count",
      "Minimum income threshold",
      "Verification period",
      "Proof validity status"
    ]
  }
];

const PURPOSE_CONSENT_TTL_MS: number = 15 * 60 * 1000;

function ResultItem({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-slate-100">{value}</dd>
    </div>
  );
}

const statusStyles: Record<VerifyProofResponse["status"], { bg: string; text: string; border: string }> = {
  valid: {
    bg: "bg-emerald-300/10",
    text: "text-emerald-100",
    border: "border-emerald-300/30"
  },
  expired: {
    bg: "bg-amber-300/10", 
    text: "text-amber-100",
    border: "border-amber-300/30"
  },
  revoked: {
    bg: "bg-rose-300/10",
    text: "text-rose-100", 
    border: "border-rose-300/30"
  },
  unknown: {
    bg: "bg-slate-300/10",
    text: "text-slate-100",
    border: "border-slate-300/20"
  },
  invalid: {
    bg: "bg-rose-300/10",
    text: "text-rose-100", 
    border: "border-rose-300/30"
  }
};

function getStatusMessage(result: VerifyProofResponse["result"]): string {
  switch (result) {
    case "VALID":
      return "This proof has been successfully verified and is currently valid.";
    case "EXPIRED":
      return "This proof has expired and is no longer valid for verification.";
    case "REVOKED": 
      return "This proof has been revoked and is no longer valid.";
    case "INVALID_SIGNATURE":
      return "The cryptographic signature for this proof is invalid.";
    case "UNKNOWN_PROOF":
      return "No matching proof was found for this identifier.";
    case "UNVERIFIED_ISSUER":
      return "The issuer of this proof could not be verified.";
    default:
      return "The verification status could not be determined.";
  }
}

function LoadingState() {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 print:hidden">
      <div className="flex items-center gap-3">
        <div className="animate-spin rounded-full h-5 w-5 border-2 border-cyan-300 border-t-transparent"></div>
        <span className="text-slate-300">Verifying proof...</span>
      </div>
    </div>
  );
}

function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-6 print:hidden">
      <h3 className="text-lg font-semibold text-rose-100 mb-3">Verification failed</h3>
      <p className="text-sm text-slate-300 mb-4">{error}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onRetry}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-300/50 bg-cyan-300 px-6 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
        >
          Try again
        </button>
        <Link
          href="/status"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10"
        >
          Check system status
        </Link>
      </div>
    </div>
  );
}

function PurposeSelection(
  {
    purposes,
    selectedId,
    onSelect,
    disabled,
  }: {
    purposes: VerificationPurpose[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    disabled?: boolean;
  }) {
  return (
    <fieldset className="rounded-lg border border-white/10 bg-white/[0.04] p-6 print:hidden">
      <legend className="text-sm font-semibold text-white">
        Declare verification purpose
      </legend>
      <p className="mt-1 text-xs text-slate-400">
        Select the approved purpose for this verification. The purpose controls which scoped
        results are disclosed and cannot expand the disclosure beyond the approved list.
      </p>
      <div className="mt-4 space-2">
        {purposes.map((purpose) => {
          const inputId = `verification-purpose-${purpose.id}`;
          const checked = selectedId === purpose.id;
          return (
            <label
              key={purpose.id}
              htmlFor={inputId}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition ${
                checked
                  ? "border-cyan-300/50 bg-cyan-300/10"
                  : "border-white/10 hover:bg-white/[0.06]"
              }`}
            >
              <input
                id={inputId}
                type="radio"
                name="verification-purpose"
                value={purpose.id}
                checked={checked}
                disabled={disabled}
                onChange={() => onSelect(purpose.id)}
                className="mt-1 h-4 w-4 accent-cyan-300"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-white">{purpose.label}</span>
                <span className="mt-0.5 block text-xs text-slate-400">{purpose.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function DisclosurePreview(
  {
    purpose,
    consentAt,
    expiresAt,
  }: {
    purpose: VerificationPurpose;
    consentAt: number;
    expiresAt: number;
  }) {
  return (
    <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4 print:hidden">
      <h3 className="text-sm font-semibold text-cyan-200">Disclosure preview</h3>
      <p className="mt-1 text-xs text-slate-300">
        Selecting <span className="font-semibold text-white">{purpose.label}</span> discloses only the following scoped results:
      </p>
      <ul className="mt-2 space-y-1 text-xs text-slate-300">
        {purpose.disclosures.map((disclosure) => (
          <li key={disclosure} className="flex items-start gap-2">
            <span className="mt-0.5 text-cyan-300">•</span>
            <span>{disclosure}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-3 grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-400">Consent recorded</dt>
          <dd className="mt-0.5">
            <Timestamp value={new Date(consentAt).toISOString()} />
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-400">Purpose consent expires</dt>
          <dd className="mt-0.5">
            <Timestamp value={new Date(expiresAt).toISOString()} />
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-400">
        The purpose declaration is not shared with the subject and does not reveal verifier identity publicly.
      </p>
    </div>
  );
}

function PurposeDenialState({
  reason,
  onReset,
}: {
  reason: string;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-6 print:hidden">
      <h3 className="text-lg font-semibold text-rose-100 mb-3">Purpose declaration denied</h3>
      <p className="text-sm text-slate-300 mb-4">{reason}</p>
      <button
        onClick={onReset}
        className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10"
      >
        Choose a different purpose
      </button>
    </div>
  );
}

function VerificationResult({
  result,
  isLive,
}: {
  result: VerifyProofResponse;
  isLive: boolean;
}) {
  const statusStyle = statusStyles[result.status];

  return (
    <div className="space-y-6">
      {/* Interactive on-screen presentation is excluded from print; only
          PrintableProofSummary below renders when printing. */}
      <div className="space-y-6 print:hidden">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`inline-flex rounded-md border px-4 py-2 text-sm font-semibold uppercase ${statusStyle.border} ${statusStyle.bg} ${statusStyle.text}`}>
            {result.status}
          </div>
          {isLive && (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 animate-pulse" />
              Watching for updates
            </span>
          )}
        </div>

      <ProofLifecycleTimeline
        proof={{
          result: result.result,
          issuedAt: result.credential?.issuedAt,
          expiresAt: result.proof?.expiresAt,
          revokedAt: result.proof?.revokedAt,
        }}
      />

      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
        <p className="text-sm leading-6 text-slate-300 mb-4">
          {getStatusMessage(result.result)}
        </p>

          {result.credential && result.proof ? (
            <dl className="grid gap-4 text-sm text-slate-300 sm:grid-cols-2">
              <ResultItem label="Proof ID" value={result.proof.id} />
              <ResultItem label="Network" value={result.proof.network} />
              <ResultItem
                label="Claim type"
                value="Minimum income verification"
              />
              <ResultItem
                label="Threshold"
                value={formatMessage(">= {amount} {asset}", {
                  amount: result.credential.claim.thresholdAmount,
                  asset: result.credential.claim.assetCode,
                })}
              />
              <ResultItem
                label="Qualifying payments"
                value={String(result.credential.claim.qualifyingPaymentCount)}
              />
              <ResultItem
                label="Verification period"
                value={formatDateRange(
                  result.credential.claim.periodStart,
                  result.credential.claim.periodEnd,
                )}
              />
              <ResultItem
                label="Issued"
                value={<Timestamp value={result.credential.issuedAt} />}
              />
              <ResultItem
                label="Expires"
                value={<Timestamp value={result.credential.expiresAt} />}
              />
              {result.proof.revokedAt && (
                <ResultItem
                  label="Revoked"
                  value={<Timestamp value={result.proof.revokedAt} />}
                />
              )}
              <ResultItem
                label="Wallet hash"
                value={`${result.credential.subject.walletHash.substring(0, 16)}...`}
              />
            </dl>
          ) : (
            <div className="text-center py-8">
              <h3 className="text-lg font-semibold text-white mb-2">No proof details available</h3>
              <p className="text-sm text-slate-300">
                The proof identifier was not found or the credential details are not accessible.
              </p>
            </div>
          )}
        </div>

        {result.credential?.privacy && (
          <div className="rounded-lg border border-cyan-300/20 bg-cyan-300/5 p-4">
            <h3 className="text-sm font-semibold text-cyan-200 mb-2">Privacy notice</h3>
            <ul className="space-y-1 text-xs text-slate-300">
              {result.credential.privacy.exactIncomeHidden && (
                <li className="flex items-start gap-2">
                  <span className="text-cyan-300 mt-0.5">•</span>
                  <span>Exact income amounts are hidden to protect financial privacy</span>
                </li>
              )}
              {result.credential.privacy.sourceTransactionsHidden && (
                <li className="flex items-start gap-2">
                  <span className="text-cyan-300 mt-0.5">•</span>
                  <span>Source transaction details are hidden to protect payment privacy</span>
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Provenance chain display when available - shown with full details */}
        {hasProvenance(result) && result.provenance && (
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-6">
            <ProvenianceChainDisplay
              chain={result.provenance}
              title="Verification Source Provenance"
              showDetails={true}
              expandedByDefault={false}
            />
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/verify"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10"
          >
            Verify another proof
          </Link>
          <Link
            href="/proofs"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-300/50 bg-cyan-300 px-6 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
          >
            Create your own proof
          </Link>
        </div>
      </div>

      <PrintableProofSummary result={result} />
    </div>
  );
}

function mapErrorMessage(raw: string): string {
  if (raw.includes("404")) {
    return "Proof not found. Please check the proof identifier and try again.";
  }
  if (raw.includes("500")) {
    return "Server error occurred during verification. Please try again later.";
  }
  if (raw.toLowerCase().includes("timeout") || raw.toLowerCase().includes("timed out")) {
    return "Request timed out. Please check your connection and try again.";
  }
  return "Unable to verify proof. Please check your connection and try again.";
}

export default function VerifyProofPage({ params }: { params: { proofId: string } }) {
  // This endpoint takes no auth token (see verifyProof's doc comment), so
  // the hook's unused `token` slot doubles as a retry nonce: bumping it
  // changes the hook's internal (proofId, token) key, which restarts a
  // fresh polling loop — giving the "Try again" button an immediate manual
  // retry on top of the hook's own automatic backoff-and-retry.
  const [retryNonce, setRetryNonce] = useState(0);
  const polling = useProofStatusPolling(params.proofId, String(retryNonce));

  const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(null);
  const [consentAt, setConsentAt] = useState<number | null>(null);
  const [denialReason, setDenialReason] = useState<string | null>(null);

  const selectedPurpose = useMemo(
    () =>
      selectedPurposeId
        ? APPROVED_PURPOSES.find((purpose) => purpose.id === selectedPurposeId) ?? null
        : null,
    [selectedPurposeId],
  );

  const purposeExpiresAt = consentAt !== null ? consentAt + PURPOSE_CONSENT_TTL_MS : null;
  const purposeExpired = purposeExpiresAt !== null && Date.now() >= purposeExpiresAt;

  const handleSelectPurpose = (id: string) => {
    const purpose = APPROVED_PURPOSES.find((candidate) => candidate.id === id);
    if (!purpose) {
      setDenialReason(null);
      return;
    }
    setSelectedPurposeId(purpose.id);
    setConsentAt(Date.now());
    setDenialReason(null);
  };

  const handleResetPurpose = () => {
    setSelectedPurposeId(null);
    setConsentAt(null);
    setDenialReason(null);
  };

  const handleRetry = () => setRetryNonce((n) => n + 1);

  const displayError = polling.error ? mapErrorMessage(polling.error) : null;

  const showPurposeControls = !!polling.data && !!polling.data.credential && !!polling.data.proof;
  const showResult = !!polling.data && !!selectedPurpose && !purposeExpired && !denialReason;

  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading
          title="Proof verification"
          description={formatMessage("Verification result for proof {proofId}", {
            proofId: params.proofId,
          })}
        />

        {polling.loading && !polling.data && <LoadingState />}

        {displayError && !polling.data && (
          <ErrorState error={displayError} onRetry={handleRetry} />
        )}

        {polling.data && (
          <div className="space-y-6">
            {showPurposeControls && (
              <>
                <PurposeSelection
                  purposes={APPROVED_PURPOSES}
                  selectedId={selectedPurposeId}
                  onSelect={handleSelectPurpose}
                />
                {selectedPurpose && consentAt !== null && purposeExpiresAt !== null && (
                  <DisclosurePreview
                    purpose={selectedPurpose}
                    consentAt={consentAt}
                    expiresAt={purposeExpiresAt}
                  />
                )}
                {selectedPurpose && purposeExpired && (
                  <PurposeDenialState
                    reason="Purpose consent has expired. Re-select an approved purpose to continue."
                    onReset={handleResetPurpose}
                  />
                )}
                {denialReason && (
                  <PurposeDenialState reason={denialReason} onReset={handleResetPurpose} />
                )}
              </>
            )}

            {showResult && (
              <VerificationResult result={polling.data} isLive={!polling.isTerminal} />
            )}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
