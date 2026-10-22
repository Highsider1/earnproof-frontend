"use client";

import { GAP_POLICY_OPTIONS, type GapPolicy } from "@/lib/validation/employment-continuity-proofs";

export function ContinuityConfigStep({
  continuityLengthMonths,
  gapPolicy,
  onContinuityLengthMonthsChange,
  onGapPolicyChange,
}: {
  continuityLengthMonths: number;
  gapPolicy: GapPolicy;
  onContinuityLengthMonthsChange: (months: number) => void;
  onGapPolicyChange: (policy: GapPolicy) => void;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Continuity Configuration</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Choose how many months of continuous employment income to prove, and how
          tolerant the check should be of short breaks between qualifying payments.
        </p>
      </div>

      <label className="grid gap-2 text-sm text-slate-200" htmlFor="continuity-length">
        Continuity length (months)
        <input
          id="continuity-length"
          type="number"
          min={1}
          max={60}
          value={continuityLengthMonths}
          onChange={(event) => onContinuityLengthMonthsChange(Number(event.target.value))}
          className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
        />
      </label>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-200">Gap policy</legend>
        {GAP_POLICY_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-start gap-3 cursor-pointer rounded-md border border-white/10 bg-slate-950 p-3">
            <input
              type="radio"
              name="gap-policy"
              value={option.value}
              checked={gapPolicy === option.value}
              onChange={() => onGapPolicyChange(option.value)}
              className="mt-1 h-4 w-4"
            />
            <div>
              <div className="text-sm font-medium text-white">{option.label}</div>
              <div className="mt-1 text-xs text-slate-400">{option.description}</div>
            </div>
          </label>
        ))}
      </fieldset>
    </section>
  );
}
