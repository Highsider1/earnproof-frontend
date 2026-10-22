"use client";

import { formatAggregationPolicy, type AggregationPolicy, type EarningsSource } from "@/lib/api/aggregate-earnings-proofs";

export function AggregateDisclosurePreview({
  aggregationPolicy,
  selectedSources,
  selectedPaymentCount,
  assetCode,
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
}: {
  aggregationPolicy: AggregationPolicy;
  selectedSources: EarningsSource[];
  selectedPaymentCount: number;
  assetCode: string | null;
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (value: string) => void;
  onPeriodEndChange: (value: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Disclosure Preview</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Review exactly what this proof will disclose before creating it.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
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

      <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
        <h4 className="text-sm font-semibold text-emerald-100">What will be disclosed</h4>
        <ul className="mt-2 grid gap-1 text-xs text-emerald-200">
          <li>Aggregation policy: {formatAggregationPolicy(aggregationPolicy)}</li>
          <li>Asset: {assetCode ?? "—"}</li>
          <li>Number of qualifying sources: {selectedSources.length}</li>
          <li>Number of qualifying payments: {selectedPaymentCount}</li>
          <li>Period: {periodStart || "—"} to {periodEnd || "—"}</li>
        </ul>
      </div>

      <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3">
        <h4 className="text-sm font-semibold text-cyan-100">What stays private</h4>
        <p className="mt-1 text-xs text-cyan-200">
          The exact aggregate amount and each individual payment&apos;s amount are never included in the
          public credential — only the qualifying source and payment counts above are.
        </p>
      </div>
    </section>
  );
}
