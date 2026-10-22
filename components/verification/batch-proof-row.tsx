"use client";

import type { VerifyProofResponse } from "./verification-panel";

export type BatchProofItemStatus =
  | "invalid"
  | "duplicate"
  | "pending"
  | "verifying"
  | "verified"
  | "failed"
  | "cancelled";

export type BatchProofItem = {
  key: string;
  raw: string;
  normalizedId: string | null;
  status: BatchProofItemStatus;
  result?: VerifyProofResponse;
};

const STATUS_STYLES: Record<BatchProofItemStatus, string> = {
  invalid: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  duplicate: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  pending: "border-slate-600 bg-slate-900 text-slate-300",
  verifying: "border-cyan-300/30 bg-cyan-300/5 text-cyan-200",
  verified: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  failed: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  cancelled: "border-slate-600 bg-slate-900 text-slate-400",
};

const STATUS_LABELS: Record<BatchProofItemStatus, string> = {
  invalid: "Invalid identifier",
  duplicate: "Duplicate",
  pending: "Pending",
  verifying: "Verifying...",
  verified: "Verified",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * Only renders result.result (the server's verification enum) - never any
 * claim, amount, address, or hash field - so a batch result never exposes
 * more than the single-proof VerificationPanel would for the same
 * response, satisfying "results never expose claims beyond the
 * verification response".
 */
export function BatchProofRow({ item }: { item: BatchProofItem }) {
  return (
    <li
      className={`rounded-md border p-3 text-sm ${STATUS_STYLES[item.status]}`}
      aria-label={`${item.raw}: ${STATUS_LABELS[item.status]}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-white">{item.normalizedId ?? item.raw}</span>
        <span className="whitespace-nowrap font-semibold">{STATUS_LABELS[item.status]}</span>
      </div>
      {item.status === "invalid" && (
        <p className="mt-1 text-xs" role="alert">
          Not a recognized proof identifier or verification link.
        </p>
      )}
      {item.status === "duplicate" && (
        <p className="mt-1 text-xs" role="alert">
          This identifier already appears earlier in the batch.
        </p>
      )}
      {item.status === "verified" && item.result && (
        <p className="mt-1 text-xs">
          Result: <span className="font-semibold">{item.result.result}</span>
        </p>
      )}
      {item.status === "failed" && (
        <p className="mt-1 text-xs" role="alert">
          Verification request failed for this identifier.
        </p>
      )}
    </li>
  );
}
