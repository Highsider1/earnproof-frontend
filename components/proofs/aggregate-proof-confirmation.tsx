"use client";

import { formatAggregationPolicy, type AggregationPolicy } from "@/lib/api/aggregate-earnings-proofs";

export function AggregateProofConfirmation({
  aggregationPolicy,
  assetCode,
  periodStart,
  periodEnd,
  selectedPaymentCount,
  expiresInDays,
  onExpiresInDaysChange,
  onCreateProof,
  loading,
}: {
  aggregationPolicy: AggregationPolicy;
  assetCode: string | null;
  periodStart: string;
  periodEnd: string;
  selectedPaymentCount: number;
  expiresInDays: number;
  onExpiresInDaysChange: (value: number) => void;
  onCreateProof: () => void;
  loading: boolean;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Confirmation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Confirm the details below and create your aggregate-earnings proof.
        </p>
      </div>

      <dl className="grid gap-2 text-sm text-slate-300">
        <div className="flex justify-between">
          <dt>Aggregation policy</dt>
          <dd className="text-white">{formatAggregationPolicy(aggregationPolicy)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Asset</dt>
          <dd className="text-white">{assetCode ?? "—"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Period</dt>
          <dd className="text-white">{periodStart} to {periodEnd}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Qualifying payments</dt>
          <dd className="text-white">{selectedPaymentCount}</dd>
        </div>
      </dl>

      <label className="grid gap-2 text-sm font-medium text-slate-200" htmlFor="expires-in-days">
        Expires in (days)
        <input
          className="h-11 w-32 rounded-md border border-white/10 bg-slate-900 px-4 text-white"
          id="expires-in-days"
          max={365}
          min={1}
          onChange={(event) => onExpiresInDaysChange(parseInt(event.target.value, 10) || 1)}
          type="number"
          value={expiresInDays}
        />
      </label>

      <button
        className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={loading}
        onClick={onCreateProof}
        type="button"
      >
        {loading ? "Creating proof..." : "Create proof"}
      </button>
    </section>
  );
}
