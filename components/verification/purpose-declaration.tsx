"use client";

import { useMemo, useState } from "react";
import {
  APPROVED_PURPOSES,
  isDeclarationExpired,
  resolveDisclosure,
  validatePurposeDeclaration,
  type VerificationPurposeId,
} from "@/lib/api/verification-purpose";

export interface PurposeDeclarationProps {
  /** Disclosure fields the caller would like to request. Never expanded. */
  requestedDisclosures?: readonly string[];
  /** Server-assigned expiry of an existing declaration, if any. */
  expiresAt?: string;
  /** Whether the current declaration was rejected by the server. */
  deniedReason?: string;
  /** Called when the verifier confirms a valid declaration. */
  onSubmit?: (declaration: {
    purposeId: VerificationPurposeId;
    consentContext: string;
    note?: string;
  }) => void;
  /** Current time injection for deterministic expiry behavior in tests. */
  now?: Date;
}

const DEFAULT_CONSENT =
  "I confirm this verification is for the selected purpose and that I will not retain or re-use the disclosed data beyond that purpose.";

export function PurposeDeclaration({
  requestedDisclosures = [],
  expiresAt,
  deniedReason,
  onSubmit,
  now,
}: PurposeDeclarationProps) {
  const [purposeId, setPurposeId] = useState<VerificationPurposeId | "">("");
  const [consentContext, setConsentContext] = useState(DEFAULT_CONSENT);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const expired = useMemo(
    () => (expiresAt ? isDeclarationExpired(expiresAt, now ?? new Date()) : false),
    [expiresAt, now],
  );

  const effectiveDisclosure = useMemo(
    () => resolveDisclosure(purposeId, requestedDisclosures),
    [purposeId, requestedDisclosures],
  );

  const validationErrors = submitted
    ? validatePurposeDeclaration({ purposeId, consentContext })
    : [];

  const blocked = expired || Boolean(deniedReason);

  const handleSubmit = (event: React.FormEvent): void => {
    event.preventDefault();
    setSubmitted(true);
    if (blocked) return;
    const errors = validatePurposeDeclaration({ purposeId, consentContext });
    if (errors.length > 0) return;
    onSubmit?.({
      purposeId: purposeId as VerificationPurposeId,
      consentContext,
      note: note.trim() || undefined,
    });
  };

  return (
    <section
      aria-label="Verification purpose declaration"
      className="rounded-lg border border-white/10 bg-white/[0.04] p-6"
    >
      <h2 className="text-lg font-semibold text-white">
        Declare verification purpose
      </h2>
      <p className="mt-1 text-sm text-slate-300">
        Select an approved purpose before accessing scoped verification results.
      </p>

      {deniedReason && (
        <div
          role="alert"
          data-testid="purpose-denied"
          className="mt-4 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100"
        >
          Declaration denied: {deniedReason}
        </div>
      )}

      {expired && (
        <div
          role="alert"
          data-testid="purpose-expired"
          className="mt-4 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100"
        >
          This purpose declaration has expired. Please re-declare before continuing.
        </div>
      )}

      <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
        <fieldset disabled={blocked} className="space-y-4">
          <legend className="text-sm font-medium text-slate-200">Approved purpose</legend>
          <div className="mt-2 space-y-2">
            {APPROVED_PURPOSES.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-start gap-3 rounded-md border border-white/10 bg-slate-950/40 p-3"
              >
                <input
                  type="radio"
                  name="purposeId"
                  value={option.id}
                  checked={purposeId === option.id}
                  onChange={() => setPurposeId(option.id)}
                  className="mt-1"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{option.label}</span>
                  <span className="block text-xs text-slate-400">{option.description}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>


        <div data-testid="disclosure-preview" className="rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3">
          <h3 className="text-sm font-semibold text-cyan-200">Disclosure preview</h3>
          {purposeId ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-300">
              {effectiveDisclosure.length === 0 ? (
                <li>No fields will be disclosed for this purpose.</li>
              ) : (
                effectiveDisclosure.map((field) => <li key={field}>{field}</li>)
              )}
            </ul>
          ) : (
            <p className="mt-2 text-xs text-slate-300">Select a purpose to see exactly what will be disclosed.</p>
          )}
        </div>

        <div>
          <label htmlFor="purpose-consent" className="text-sm font-medium text-slate-200">
            Consent context
          </label>
          <textarea
            id="purpose-consent"
            value={consentContext}
            onChange={(e) => setConsentContext(e.target.value)}
            disabled={blocked}
            rows={3}
            className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/60 p-2 text-sm text-white"
          />
        </div>

        <div>
          <label htmlFor="purpose-note" className="text-sm font-medium text-slate-200">
            Note (optional)
          </label>
          <input
            id="purpose-note"
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={blocked}
            className="mt-1 w-full rounded-md border border-white/15 bg-slate-950/60 p-2 text-sm text-white"
          />
        </div>

        {submitted && validationErrors.length > 0 && (
          <div role="alert" className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-100">
            {validationErrors.join(", ")}
          </div>
        )}

        <button
          type="submit"
          disabled={blocked}
          className="inline-flex h-10 text-sm font-medium text-slate-950 transition disabled:opacity-50 rounded-lg border border-cyan-300/50 bg-cyan-300 px-6 hover:bg-cyan-200"
        >
          Confirm purpose
        </button>
      </form>
    </section>
  );
}
