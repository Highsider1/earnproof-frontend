"use client";

import { formatDateRange } from "@/lib/i18n";

export function EmploymentPeriodConfigStep({
  periodStart,
  periodEnd,
  continuityLengthMonths,
  onPeriodStartChange,
  onPeriodEndChange,
}: {
  periodStart: string;
  periodEnd: string;
  continuityLengthMonths: number;
  onPeriodStartChange: (date: string) => void;
  onPeriodEndChange: (date: string) => void;
}) {
  const start = periodStart ? new Date(periodStart) : null;
  const end = periodEnd ? new Date(periodEnd) : null;
  const isValidRange = Boolean(start && end && !isNaN(start.getTime()) && !isNaN(end.getTime()) && start < end);

  const spanMonths =
    isValidRange && start && end
      ? Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30))
      : null;

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Period Boundaries</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Set the period this continuity proof covers. It should span at least the{" "}
          {continuityLengthMonths} month{continuityLengthMonths === 1 ? "" : "s"} of continuity you configured.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="employment-period-start" className="block text-sm font-medium text-slate-200">
            Period Start
          </label>
          <input
            id="employment-period-start"
            type="date"
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            value={periodStart}
            onChange={(event) => onPeriodStartChange(event.target.value)}
          />
        </div>

        <div>
          <label htmlFor="employment-period-end" className="block text-sm font-medium text-slate-200">
            Period End
          </label>
          <input
            id="employment-period-end"
            type="date"
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            value={periodEnd}
            onChange={(event) => onPeriodEndChange(event.target.value)}
          />
        </div>
      </div>

      {!isValidRange && periodStart && periodEnd && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            Period end must be after period start.
          </p>
        </div>
      )}

      {isValidRange && start && end && (
        <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
          <p className="text-sm text-emerald-200">
            {formatDateRange(start, end)}
            {spanMonths !== null && spanMonths < continuityLengthMonths && (
              <span className="block mt-1 text-amber-200">
                This span (~{spanMonths} months) is shorter than the configured continuity length (
                {continuityLengthMonths} months). Coverage review may show missing periods.
              </span>
            )}
          </p>
        </div>
      )}
    </section>
  );
}
