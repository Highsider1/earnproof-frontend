"use client";

import { formatIncomeRange } from "@/lib/api/income-range-proofs";

export function IncomeRangeDisclosurePreview({
  lowerBound,
  upperBound,
  assetCode,
  periodStart,
  periodEnd,
  qualifyingPaymentCount,
}: {
  lowerBound: string;
  upperBound: string;
  assetCode: string | null;
  periodStart: string;
  periodEnd: string;
  qualifyingPaymentCount: number;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Disclosure Preview</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Review exactly which range facts this proof will disclose before creating it.
        </p>
      </div>

      <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
        <h4 className="text-sm font-semibold text-emerald-100">What will be disclosed</h4>
        <ul className="mt-2 grid gap-1 text-xs text-emerald-200">
          <li>Income range: {assetCode ? formatIncomeRange(lowerBound, upperBound, assetCode) : `${lowerBound} - ${upperBound}`}</li>
          <li>Period: {periodStart || "—"} to {periodEnd || "—"}</li>
          <li>Number of qualifying payments: {qualifyingPaymentCount}</li>
        </ul>
      </div>

      <div className="rounded-md border border-cyan-300/30 bg-cyan-300/10 p-3">
        <h4 className="text-sm font-semibold text-cyan-100">What stays private</h4>
        <p className="mt-1 text-xs text-cyan-200">
          The exact aggregate income within the range, and every individual payment amount, are never
          included in the public credential — only that your income fell within the disclosed range.
        </p>
      </div>
    </section>
  );
}
