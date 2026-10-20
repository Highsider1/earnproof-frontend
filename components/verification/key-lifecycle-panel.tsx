"use client";

import { formatDate } from "@/lib/i18n";
import { isBlockingKeyOutcome, type KeyDiscoveryOutcome, type KeyLifecycleState } from "@/lib/validation/key-lifecycle";

const LIFECYCLE_LABELS: Record<KeyLifecycleState, string> = {
  ACTIVE: "Active",
  OVERLAP_ROTATION: "Overlap rotation",
  RETIRED: "Retired",
  UNKNOWN: "Unknown",
};

const LIFECYCLE_EXPLANATIONS: Record<KeyLifecycleState, string> = {
  ACTIVE: "This key is the issuer's current signing key.",
  OVERLAP_ROTATION:
    "This key is being phased out in favor of a newer one, but is still accepted during the overlap window.",
  RETIRED: "This key is no longer used to sign new credentials. Existing credentials it signed may still verify.",
  UNKNOWN: "This key's lifecycle state could not be determined.",
};

const LIFECYCLE_STYLES: Record<KeyLifecycleState, string> = {
  ACTIVE: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  OVERLAP_ROTATION: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  RETIRED: "border-slate-500/30 bg-slate-500/10 text-slate-200",
  UNKNOWN: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

export function KeyLifecyclePanel({ outcome }: { outcome: KeyDiscoveryOutcome }) {
  const blocking = isBlockingKeyOutcome(outcome);

  if (outcome.kind === "UNKNOWN_KEY") {
    return (
      <section className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-4">
        <p className="text-sm font-semibold text-rose-100" role="alert">
          Signing key not recognized
        </p>
        <p className="mt-1 text-xs text-rose-200">
          This credential&apos;s proof type does not match any known signing key. Treat this result as unverified.
        </p>
      </section>
    );
  }

  if (outcome.kind === "DISCOVERY_UNAVAILABLE") {
    return (
      <section className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-4">
        <p className="text-sm font-semibold text-rose-100" role="alert">
          Key discovery unavailable
        </p>
        <p className="mt-1 text-xs text-rose-200">
          Signing key details could not be retrieved. Treat this result as unverified.
        </p>
      </section>
    );
  }

  const { key, isStale } = outcome;

  return (
    <section
      className={`grid gap-3 rounded-lg border p-4 ${blocking ? "border-rose-300/30 bg-rose-300/10" : LIFECYCLE_STYLES[key.lifecycleState]}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Signing key</h3>
        <span className="text-xs font-semibold uppercase">{LIFECYCLE_LABELS[key.lifecycleState]}</span>
      </div>

      {isStale && (
        <p className="text-xs text-amber-200" role="status">
          This key information was cached and may be out of date.
        </p>
      )}

      {blocking && (
        <p className="text-xs text-rose-200" role="alert">
          This key&apos;s lifecycle state cannot confirm trust for this credential.
        </p>
      )}

      <dl className="grid gap-2 text-xs text-slate-300">
        <div className="flex justify-between">
          <dt>Key identifier</dt>
          <dd className="font-mono">{key.keyId}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Algorithm</dt>
          <dd>{key.algorithm}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Trust source</dt>
          <dd>{key.trustSource}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Active since</dt>
          <dd>{formatDate(new Date(key.activatedAt))}</dd>
        </div>
        {key.retiredAt && (
          <div className="flex justify-between">
            <dt>Retired</dt>
            <dd>{formatDate(new Date(key.retiredAt))}</dd>
          </div>
        )}
      </dl>

      <p className="text-xs text-slate-400">{LIFECYCLE_EXPLANATIONS[key.lifecycleState]}</p>
    </section>
  );
}
