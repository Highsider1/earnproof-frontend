"use client";

import { PaymentListSkeleton } from "@/components/common/skeleton/payment-list-skeleton";
import { formatDateTime } from "@/lib/i18n";
import {
  SUPPORTED_AGGREGATION_POLICIES,
  getUnsupportedAggregationReason,
  type AggregationPolicy,
  type EarningsSource,
} from "@/lib/api/aggregate-earnings-proofs";

type Payment = {
  id: string;
  stellarTransactionHash: string;
  assetCode: string;
  assetIssuer: string | null;
  occurredAt: string;
  classification: string;
  isEligible: boolean;
};

export function AggregateSourceSelection({
  payments,
  sources,
  selectedPaymentIds,
  aggregationPolicy,
  onPaymentSelectionChange,
  onAggregationPolicyChange,
  onSyncPayments,
  onRefreshPayments,
  loading,
}: {
  payments: Payment[];
  sources: EarningsSource[];
  selectedPaymentIds: string[];
  aggregationPolicy: AggregationPolicy;
  onPaymentSelectionChange: (paymentIds: string[]) => void;
  onAggregationPolicyChange: (policy: AggregationPolicy) => void;
  onSyncPayments: () => void;
  onRefreshPayments: () => void;
  loading: boolean;
}) {
  const selectedSources = sources.filter((source) =>
    payments.some(
      (payment) =>
        selectedPaymentIds.includes(payment.id) &&
        payment.assetCode === source.assetCode &&
        payment.assetIssuer === source.assetIssuer,
    ),
  );
  const unsupportedReason = getUnsupportedAggregationReason(selectedSources, aggregationPolicy);

  function togglePayment(paymentId: string) {
    // Toggling only ever adds/removes this one id from the set, so the same
    // payment can never end up selected twice regardless of click order or
    // repeated clicks - the underlying state is a Set-like uniqueness check,
    // not an append.
    onPaymentSelectionChange(
      selectedPaymentIds.includes(paymentId)
        ? selectedPaymentIds.filter((id) => id !== paymentId)
        : [...selectedPaymentIds, paymentId],
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Source Selection</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Select eligible income payments to aggregate, and the policy used to combine them.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={loading}
            onClick={onRefreshPayments}
            type="button"
          >
            Refresh
          </button>
          <button
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
            disabled={loading}
            onClick={onSyncPayments}
            type="button"
          >
            Sync
          </button>
        </div>
      </div>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium text-slate-200">Aggregation policy</legend>
        <div className="grid gap-3 md:grid-cols-2">
          {SUPPORTED_AGGREGATION_POLICIES.map((policy) => (
            <label
              key={policy.value}
              className={`flex gap-3 rounded-md border p-4 cursor-pointer transition ${
                aggregationPolicy === policy.value
                  ? "border-cyan-300/50 bg-cyan-300/5"
                  : "border-white/10 bg-slate-950 hover:bg-slate-900"
              }`}
            >
              <input
                checked={aggregationPolicy === policy.value}
                className="mt-1 h-4 w-4"
                name="aggregation-policy"
                onChange={() => onAggregationPolicyChange(policy.value)}
                type="radio"
                value={policy.value}
              />
              <div className="flex-1">
                <div className="text-sm font-medium text-white">{policy.label}</div>
                <div className="mt-1 text-xs text-slate-400">{policy.description}</div>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <div aria-busy={loading} aria-live="polite" className="grid gap-3" role="status">
        {loading ? (
          <PaymentListSkeleton />
        ) : payments.length === 0 ? (
          <p className="rounded-md border border-white/10 bg-slate-950 p-4 text-sm text-slate-400">
            No payments loaded yet.
          </p>
        ) : (
          payments.map((payment) => {
            const canSelect = payment.classification === "INCOME" && payment.isEligible;
            return (
              <label
                className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm text-slate-300 sm:min-h-24 sm:grid-cols-[auto_1fr] sm:items-center"
                key={payment.id}
              >
                <input
                  aria-label="Select payment"
                  checked={selectedPaymentIds.includes(payment.id)}
                  disabled={!canSelect}
                  onChange={() => togglePayment(payment.id)}
                  type="checkbox"
                />
                <div className="min-w-0">
                  <p className="font-medium text-white">{payment.assetCode} incoming payment</p>
                  <p className="mt-1 break-all text-xs text-slate-400">{payment.stellarTransactionHash}</p>
                  <p className="mt-1 text-xs text-slate-400">{formatDateTime(payment.occurredAt)}</p>
                </div>
              </label>
            );
          })
        )}
      </div>

      {unsupportedReason ? (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-100" role="alert">
            {unsupportedReason}
          </p>
        </div>
      ) : null}
    </section>
  );
}
