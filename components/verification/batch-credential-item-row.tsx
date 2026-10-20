"use client";

import type { VerifyProofResponse } from "./verification-panel";

export type BatchItemStatus = "pending" | "verifying" | "verified" | "rejected" | "failed" | "cancelled";

export type BatchItem = {
  key: string;
  source: "file" | "manual";
  label: string;
  credentialId: string | null;
  status: BatchItemStatus;
  rejectReason?: string;
  result?: VerifyProofResponse;
};

const STATUS_STYLES: Record<BatchItemStatus, string> = {
  pending: "border-slate-600 bg-slate-900 text-slate-300",
  verifying: "border-cyan-300/30 bg-cyan-300/5 text-cyan-200",
  verified: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  rejected: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  failed: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  cancelled: "border-slate-600 bg-slate-900 text-slate-400",
};

const STATUS_LABELS: Record<BatchItemStatus, string> = {
  pending: "Pending",
  verifying: "Verifying...",
  verified: "Verified",
  rejected: "Rejected",
  failed: "Failed",
  cancelled: "Cancelled",
};

/**
 * A verified item never shows more than the same fields VerificationPanel
 * would show for a single credential: this row deliberately does not fold
 * in amounts, addresses, or hashes for a batch context, only the status and
 * the server's result enum.
 */
export function BatchCredentialItemRow({ item }: { item: BatchItem }) {
  return (
    <li className={`rounded-md border p-3 text-sm ${STATUS_STYLES[item.status]}`}>
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-white">{item.label}</span>
        <span className="whitespace-nowrap font-semibold">{STATUS_LABELS[item.status]}</span>
      </div>
      {item.status === "rejected" && item.rejectReason && (
        <p className="mt-1 text-xs" role="alert">
          {item.rejectReason}
        </p>
      )}
      {item.status === "verified" && item.result && (
        <p className="mt-1 text-xs">
          Result: <span className="font-semibold">{item.result.result}</span>
        </p>
      )}
      {item.status === "failed" && (
        <p className="mt-1 text-xs" role="alert">
          Verification request failed for this item.
        </p>
      )}
    </li>
  );
}
