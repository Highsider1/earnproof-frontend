"use client";

import { formatDateRange } from "@/lib/i18n";
import { maxGapDaysForPolicy, type GapPolicy } from "@/lib/validation/employment-continuity-proofs";

export type PeriodCoverageEntry = {
  start: string;
  end: string;
  covered: boolean;
  qualifyingPaymentCount: number;
};

export function CoverageReviewStep({
  periods,
  gapPolicy,
  assetCode,
  assetIssuer,
  onAssetCodeChange,
  onAssetIssuerChange,
}: {
  periods: PeriodCoverageEntry[];
  gapPolicy: GapPolicy;
  assetCode: string;
  assetIssuer: string;
  onAssetCodeChange: (code: string) => void;
  onAssetIssuerChange: (issuer: string) => void;
}) {
  const missingPeriods = periods.filter((period) => !period.covered);
  const coveredCount = periods.length - missingPeriods.length;
  const maxGapDays = maxGapDaysForPolicy(gapPolicy);

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Coverage Review</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          This summary only shows which periods have at least one qualifying payment.
          Individual payment amounts, memos, and counterparties are never shown here.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm text-slate-200" htmlFor="continuity-asset-code">
          Asset code
          <input
            id="continuity-asset-code"
            type="text"
            value={assetCode}
            onChange={(event) => onAssetCodeChange(event.target.value)}
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
            placeholder="USDC"
          />
        </label>

        <label className="grid gap-2 text-sm text-slate-200" htmlFor="continuity-asset-issuer">
          Asset issuer (optional)
          <input
            id="continuity-asset-issuer"
            type="text"
            value={assetIssuer}
            onChange={(event) => onAssetIssuerChange(event.target.value)}
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
            placeholder="G..."
          />
        </label>
      </div>

      <div
        className={`rounded-md border p-3 ${
          missingPeriods.length === 0
            ? "border-emerald-300/30 bg-emerald-300/10"
            : "border-amber-300/30 bg-amber-300/10"
        }`}
      >
        <p className={`text-sm ${missingPeriods.length === 0 ? "text-emerald-200" : "text-amber-200"}`}>
          {coveredCount} of {periods.length} periods covered.
          {maxGapDays > 0 && ` Gap policy tolerates up to ${maxGapDays} days between qualifying payments.`}
        </p>
      </div>

      <ul className="grid gap-2" aria-label="Period coverage">
        {periods.map((period) => (
          <li
            key={period.start}
            className={`flex items-center justify-between rounded-md border p-3 text-sm ${
              period.covered ? "border-emerald-300/20 bg-emerald-300/5 text-emerald-200" : "border-rose-300/20 bg-rose-300/5 text-rose-200"
            }`}
          >
            <span>{formatDateRange(new Date(period.start), new Date(period.end))}</span>
            <span className="font-semibold">{period.covered ? "Covered" : "Missing"}</span>
          </li>
        ))}
      </ul>

      {periods.length === 0 && (
        <p className="text-sm text-slate-400">Set period boundaries in the previous step to see coverage.</p>
      )}
    </section>
  );
}
