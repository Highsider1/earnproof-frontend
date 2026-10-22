"use client";

import { formatDateTime } from "@/lib/i18n";
import type { Payment } from "@/lib/api/payments";

/**
 * Explains a payment's eligibility using only real, backend-provided
 * fields (#170).
 *
 * The Payment schema has no reason-code field — only a boolean isEligible
 * and a classification enum. #170's own acceptance criterion is "The
 * client does not infer eligibility independently of the backend", so
 * this deliberately does NOT synthesize human-readable "reasons" from
 * classification/asset/date client-side (e.g. inventing "Excluded:
 * personal transfer, insufficient confirmations" text) — that would be
 * exactly the independent inference the issue prohibits. Instead it shows
 * the real classification and eligibility flag plainly, with an explicit
 * note that finer-grained reason codes aren't available from this API.
 */
export function PaymentEligibilityExplanation({
  payment,
  isStale,
}: {
  payment: Payment;
  isStale?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">Eligibility</h3>
        <EligibilityBadge isEligible={payment.isEligible} />
      </div>

      {isStale && (
        <p className="mt-2 text-xs text-amber-300" role="status">
          This explanation may be out of date. Refresh after a classification
          or policy change to see the latest decision.
        </p>
      )}

      <dl className="mt-3 grid gap-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Classification</dt>
          <dd className="text-slate-200">{formatClassification(payment.classification)}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Asset</dt>
          <dd className="text-slate-200">{payment.assetCode}</dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-slate-400">Occurred</dt>
          <dd className="text-slate-200">{formatDateTime(payment.occurredAt)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-slate-500">
        Detailed exclusion reason codes are not provided by the API yet. This
        reflects the payment&apos;s underlying classification and eligibility
        flag as returned by the server, without inferring a reason on the
        client.
      </p>
    </div>
  );
}

function EligibilityBadge({ isEligible }: { isEligible: boolean }) {
  const className = isEligible
    ? "text-emerald-300 bg-emerald-400/10 border-emerald-300/30"
    : "text-rose-300 bg-rose-400/10 border-rose-300/30";
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-1 text-xs font-semibold ${className}`}
    >
      {isEligible ? "Eligible" : "Excluded"}
    </span>
  );
}

function formatClassification(classification: Payment["classification"]): string {
  switch (classification) {
    case "INCOME":
      return "Income";
    case "REIMBURSEMENT":
      return "Reimbursement";
    case "PERSONAL_TRANSFER":
      return "Personal Transfer";
    case "EXCLUDED":
      return "Excluded";
    case "UNKNOWN":
    default:
      return "Unclassified";
  }
}
