"use client";

import { formatDateRange } from "@/lib/i18n";
import { GAP_POLICY_OPTIONS, type GapPolicy } from "@/lib/validation/employment-continuity-proofs";

export function EmploymentContinuityConfirmation({
  continuityLengthMonths,
  gapPolicy,
  periodStart,
  periodEnd,
  assetCode,
  totalPeriods,
  coveredPeriods,
  expiresInDays,
  onExpiresInDaysChange,
  onCreateProof,
  loading,
}: {
  continuityLengthMonths: number;
  gapPolicy: GapPolicy;
  periodStart: string;
  periodEnd: string;
  assetCode: string;
  totalPeriods: number;
  coveredPeriods: number;
  expiresInDays: number;
  onExpiresInDaysChange: (days: number) => void;
  onCreateProof: () => void;
  loading: boolean;
}) {
  const gapPolicyLabel = GAP_POLICY_OPTIONS.find((option) => option.value === gapPolicy)?.label ?? gapPolicy;
  const canSubmit = totalPeriods > 0 && assetCode.trim().length > 0;

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Confirmation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Review your employment-continuity proof before submitting.
        </p>
      </div>

      <dl className="grid gap-2 text-sm text-slate-300">
        <div className="flex justify-between">
          <dt>Continuity length</dt>
          <dd>{continuityLengthMonths} months</dd>
        </div>
        <div className="flex justify-between">
          <dt>Gap policy</dt>
          <dd>{gapPolicyLabel}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Period</dt>
          <dd>{periodStart && periodEnd ? formatDateRange(new Date(periodStart), new Date(periodEnd)) : "-"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Asset</dt>
          <dd>{assetCode || "-"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Coverage</dt>
          <dd>
            {coveredPeriods} of {totalPeriods} periods
          </dd>
        </div>
      </dl>

      <label className="grid gap-2 text-sm text-slate-200" htmlFor="continuity-expires-in-days">
        Expires in (days)
        <input
          id="continuity-expires-in-days"
          type="number"
          min={1}
          max={365}
          value={expiresInDays}
          onChange={(event) => onExpiresInDaysChange(Number(event.target.value))}
          className="h-10 w-32 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
        />
      </label>

      <button
        type="button"
        onClick={onCreateProof}
        disabled={loading || !canSubmit}
        className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating proof..." : "Create Proof"}
      </button>
    </section>
  );
}
