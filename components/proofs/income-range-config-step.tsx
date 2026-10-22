"use client";

import { PaymentListSkeleton } from "@/components/common/skeleton/payment-list-skeleton";
import { formatDateTime } from "@/lib/i18n";
import { validateIncomeRange } from "@/lib/api/income-range-proofs";

type Payment = {
  id: string;
  stellarTransactionHash: string;
  assetCode: string;
  assetIssuer: string | null;
  occurredAt: string;
  classification: string;
  isEligible: boolean;
};

export function IncomeRangeConfigStep({
  payments,
  selectedPaymentIds,
  lowerBound,
  upperBound,
  periodStart,
  periodEnd,
  onPaymentSelectionChange,
  onLowerBoundChange,
  onUpperBoundChange,
  onPeriodStartChange,
  onPeriodEndChange,
  onSyncPayments,
  onRefreshPayments,
  loading,
}: {
  payments: Payment[];
  selectedPaymentIds: string[];
  lowerBound: string;
  upperBound: string;
  periodStart: string;
  periodEnd: string;
  onPaymentSelectionChange: (paymentIds: string[]) => void;
  onLowerBoundChange: (value: string) => void;
  onUpperBoundChange: (value: string) => void;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
  onSyncPayments: () => void;
  onRefreshPayments: () => void;
  loading: boolean;
}) {
  const rangeError = validateIncomeRange(lowerBound, upperBound);

  function togglePayment(paymentId: string) {
    onPaymentSelectionChange(
      selectedPaymentIds.includes(paymentId)
        ? selectedPaymentIds.filter((id) => id !== paymentId)
        : [...selectedPaymentIds, paymentId],
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Range Configuration</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Choose the income range, period, asset, and qualifying payments to include in the proof.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Lower bound
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => onLowerBoundChange(event.target.value)}
            type="text"
            value={lowerBound}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Upper bound
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => onUpperBoundChange(event.target.value)}
            type="text"
            value={upperBound}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Period start
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => onPeriodStartChange(event.target.value)}
            type="date"
            value={periodStart}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Period end
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => onPeriodEndChange(event.target.value)}
            type="date"
            value={periodEnd}
          />
        </label>
      </div>

      {rangeError ? (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {rangeError}
          </p>
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">Qualifying payments</h3>
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
    </section>
  );
}
