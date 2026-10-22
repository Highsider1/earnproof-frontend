"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import {
  getIssuerAttestations,
  createIssuerAttestation,
  revokeIssuerAttestation,
  canIssuerCreateAttestations,
  getEffectiveAttestationStatus,
  formatAttestationType,
  formatAttestationStatus,
  getAttestationStatusTone,
  ATTESTATION_TYPES,
  type IssuerAttestation,
  type AttestationStatus,
} from "@/lib/api/issuer-attestations";
import {
  createAttestationSchema,
  DEFAULT_ATTESTATION_EXPIRY_DAYS,
  type CreateAttestationInput,
} from "@/lib/validation/issuer-attestations";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { StatusBadge } from "@/components/common/production-ui";
import { formatDate, formatMessage } from "@/lib/i18n";

type ViewerRole = "ADMIN" | "ISSUER" | "WORKER" | "DEVELOPER" | string;

const STATUS_FILTERS: Array<{ value: AttestationStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "EXPIRED", label: "Expired" },
  { value: "REVOKED", label: "Revoked" },
];

/**
 * Attestation creation, listing, and revocation for a single issuer.
 *
 * Server-endpoint status: `/issuers/{id}/attestations` does not exist in
 * the current backend (see `lib/api/issuer-attestations.ts`). A failed
 * fetch renders an explicit "unavailable" state rather than an empty
 * list, distinguishing "no attestations" from "couldn't load
 * attestations".
 *
 * Privacy: the list view never shows signed payload/credential material —
 * only status metadata. The one-time signed payload returned by creation
 * is held only in component state for the current session and is never
 * written to localStorage/sessionStorage; it clears on dismiss, refresh,
 * or navigation.
 */
export function IssuerAttestations({
  issuerId,
  issuerName,
  issuerStatus,
  viewerRole,
  onEligibilityChanged,
  token,
}: {
  issuerId: string;
  issuerName: string;
  issuerStatus: string;
  viewerRole: ViewerRole | null;
  /**
   * Called after any status-changing action (creation or revocation) so
   * dependent eligibility views (e.g. proof wizards that read issuer
   * attestations) can refresh rather than operating on stale data.
   */
  onEligibilityChanged?: () => void;
  token: string;
}) {
  const [attestations, setAttestations] = useState<IssuerAttestation[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<AttestationStatus | "ALL">("ALL");
  const [confirmRevoke, setConfirmRevoke] = useState<IssuerAttestation | null>(null);
  const [oneTimePayload, setOneTimePayload] = useState<{ attestationId: string; payload: string } | null>(
    null
  );

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAttestationInput>({
    defaultValues: {
      subjectWalletHash: "",
      type: ATTESTATION_TYPES[0],
      expiresInDays: DEFAULT_ATTESTATION_EXPIRY_DAYS,
    },
  });

  const isAuthorizedIssuer = viewerRole === "ADMIN" || viewerRole === "ISSUER";
  const isIssuerActive = canIssuerCreateAttestations(issuerStatus);
  const canCreate = isAuthorizedIssuer && isIssuerActive;

  const loadAttestations = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const controller = new AbortController();
      const result = await getIssuerAttestations(token, issuerId, controller.signal);
      setAttestations(result);
      setHasLoaded(true);
    } catch {
      setLoadError(
        "Attestation history is unavailable right now. The issuer attestation service could not be reached."
      );
      setHasLoaded(false);
    } finally {
      setLoading(false);
    }
  }, [token, issuerId]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadAttestations();
      }
    });

    return () => {
      active = false;
    };
  }, [loadAttestations]);

  const onCreate = useCallback(
    async (data: CreateAttestationInput) => {
      setActionError(null);

      if (!isAuthorizedIssuer) {
        setActionError("Only authorized issuers can create attestations.");
        return;
      }
      if (!isIssuerActive) {
        setActionError("This issuer is not active. Only active issuers can create attestations.");
        return;
      }

      try {
        const validated = createAttestationSchema.parse(data);
        const controller = new AbortController();
        const response = await createIssuerAttestation(token, issuerId, validated, controller.signal);
        setAttestations((prev) => [...prev, response.attestation]);
        setOneTimePayload({ attestationId: response.attestation.id, payload: response.signedPayload });
        reset({ subjectWalletHash: "", type: ATTESTATION_TYPES[0], expiresInDays: DEFAULT_ATTESTATION_EXPIRY_DAYS });
        onEligibilityChanged?.();
      } catch (err) {
        setActionError(
          err instanceof Error
            ? err.message
            : "Failed to create attestation. Check the subject and type, then try again."
        );
      }
    },
    [token, issuerId, isAuthorizedIssuer, isIssuerActive, reset, onEligibilityChanged]
  );

  const onRevoke = useCallback(
    async (attestation: IssuerAttestation) => {
      setActionLoading(attestation.id);
      setActionError(null);
      try {
        const controller = new AbortController();
        const updated = await revokeIssuerAttestation(token, issuerId, attestation.id, controller.signal);
        setAttestations((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
        onEligibilityChanged?.();
      } catch {
        setActionError("Failed to revoke attestation. Please try again.");
      } finally {
        setActionLoading(null);
        setConfirmRevoke(null);
      }
    },
    [token, issuerId, onEligibilityChanged]
  );

  const visibleAttestations = useMemo(() => {
    return attestations
      .map((a) => ({ ...a, effectiveStatus: getEffectiveAttestationStatus(a) }))
      .filter((a) => statusFilter === "ALL" || a.effectiveStatus === statusFilter);
  }, [attestations, statusFilter]);

  return (
    <section
      aria-label={formatMessage("Attestations for {issuerName}", { issuerName })}
      className="grid gap-4 rounded-lg border border-white/10 bg-slate-950 p-4"
    >
      <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-lg font-semibold text-white">Attestations</h3>
          <p className="mt-1 text-xs text-slate-400">
            Create attestations for a subject, and track active, expired, and revoked history.
          </p>
        </div>
        <button
          className="h-9 rounded-md border border-white/15 px-3 text-xs font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={loadAttestations}
          type="button"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {!isIssuerActive && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-100">
            This issuer is {issuerStatus.toLowerCase()}. Only active issuers can create attestations.
          </p>
        </div>
      )}

      {isIssuerActive && !isAuthorizedIssuer && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-100">
            Creating attestations requires issuer or administrator access.
          </p>
        </div>
      )}

      {loadError && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {loadError}
          </p>
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {actionError}
          </p>
        </div>
      )}

      {oneTimePayload && (
        <div className="rounded-md border border-cyan-300/30 bg-cyan-300/5 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cyan-100">Signed attestation payload</p>
              <p className="mt-1 text-xs text-cyan-200">
                Shown once. This is not saved anywhere by this app — copy it now if you need it,
                then dismiss.
              </p>
              <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-slate-900 p-2 text-xs text-slate-200">
                {oneTimePayload.payload}
              </pre>
            </div>
            <button
              className="h-8 shrink-0 rounded border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/5"
              onClick={() => setOneTimePayload(null)}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <fieldset className="grid gap-3 sm:grid-cols-[1.5fr_1fr_1fr_auto] sm:items-end" disabled={!canCreate}>
        <legend className="sr-only">Create attestation</legend>
        <form className="contents" onSubmit={handleSubmit(onCreate)}>
          <div>
            <label className="block text-xs font-medium text-slate-200" htmlFor={`subject-${issuerId}`}>
              Subject wallet hash
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white placeholder:text-slate-400 disabled:opacity-50"
              id={`subject-${issuerId}`}
              placeholder="sha256:..."
              type="text"
              {...register("subjectWalletHash", { required: "Subject wallet hash is required" })}
            />
            {errors.subjectWalletHash && (
              <p className="mt-1 text-xs text-rose-200" role="alert">
                {errors.subjectWalletHash.message}
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-200" htmlFor={`type-${issuerId}`}>
              Type
            </label>
            <select
              className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
              id={`type-${issuerId}`}
              {...register("type")}
            >
              {ATTESTATION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatAttestationType(type)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-200" htmlFor={`expires-${issuerId}`}>
              Expires (days)
            </label>
            <input
              className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white disabled:opacity-50"
              id={`expires-${issuerId}`}
              max={365}
              min={1}
              type="number"
              {...register("expiresInDays", { valueAsNumber: true, required: true, min: 1, max: 365 })}
            />
            {errors.expiresInDays && (
              <p className="mt-1 text-xs text-rose-200" role="alert">
                Expiry must be between 1 and 365 days
              </p>
            )}
          </div>
          <button
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
            type="submit"
          >
            Create
          </button>
        </form>
      </fieldset>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter attestations by status">
        {STATUS_FILTERS.map((filter) => (
          <button
            aria-pressed={statusFilter === filter.value}
            className={`h-8 rounded-full border px-3 text-xs font-medium transition ${
              statusFilter === filter.value
                ? "border-cyan-300/50 bg-cyan-300/10 text-cyan-200"
                : "border-white/15 text-slate-300 hover:bg-white/5"
            }`}
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            type="button"
          >
            {filter.label}
          </button>
        ))}
      </div>

      {loading && attestations.length === 0 && !loadError ? (
        <p className="text-sm text-slate-400">Loading attestations...</p>
      ) : !hasLoaded && loadError ? null : visibleAttestations.length === 0 ? (
        <p className="text-sm text-slate-400">
          {attestations.length === 0
            ? "No attestations yet. Create one above."
            : "No attestations match the selected filter."}
        </p>
      ) : (
        <ul className="grid gap-2">
          {visibleAttestations.map((attestation) => (
            <li
              className="grid gap-2 rounded-md border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-center"
              key={attestation.id}
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-slate-300">{attestation.subjectWalletHash}</p>
              </div>
              <div className="text-xs text-slate-300">{formatAttestationType(attestation.type)}</div>
              <div>
                <StatusBadge tone={getAttestationStatusTone(attestation.effectiveStatus)}>
                  {formatAttestationStatus(attestation.effectiveStatus)}
                </StatusBadge>
              </div>
              <div className="text-xs text-slate-400">
                {attestation.effectiveStatus === "REVOKED" && attestation.revokedAt
                  ? formatMessage("Revoked {date}", { date: formatDate(attestation.revokedAt) })
                  : formatMessage("Expires {date}", { date: formatDate(attestation.expiresAt) })}
              </div>
              <div className="flex justify-end">
                <button
                  aria-label={formatMessage("Revoke attestation for {subject}", {
                    subject: attestation.subjectWalletHash,
                  })}
                  className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                  disabled={attestation.effectiveStatus !== "ACTIVE" || actionLoading === attestation.id}
                  onClick={() => setConfirmRevoke(attestation)}
                  type="button"
                >
                  {actionLoading === attestation.id ? "..." : "Revoke"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmRevoke && (
        <ConfirmationDialog
          confirmText="Revoke Attestation"
          confirmVariant="danger"
          isProcessing={actionLoading === confirmRevoke.id}
          message={formatMessage(
            'Are you sure you want to revoke the attestation for "{subject}"? This action cannot be undone and any dependent eligibility checks will stop counting it immediately.',
            { subject: confirmRevoke.subjectWalletHash }
          )}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => onRevoke(confirmRevoke)}
          title="Revoke Attestation"
        />
      )}
    </section>
  );
}
