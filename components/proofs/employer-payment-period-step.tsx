"use client";

export function EmployerPaymentPeriodStep({
  periodStart,
  periodEnd,
  onPeriodStartChange,
  onPeriodEndChange,
}: {
  periodStart: string;
  periodEnd: string;
  onPeriodStartChange: (date: string) => void;
  onPeriodEndChange: (date: string) => void;
}) {
  const validationError =
    periodStart && periodEnd && new Date(periodStart) >= new Date(periodEnd)
      ? "Period end must be after period start"
      : null;

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Period</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Choose the bounded period to check for eligible employer payments. Changing this period
          after selecting a source will require you to re-select a source, since matches are
          period-specific.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="employer-period-start">
            Period Start
          </label>
          <input
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            id="employer-period-start"
            onChange={(e) => onPeriodStartChange(e.target.value)}
            type="date"
            value={periodStart}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="employer-period-end">
            Period End
          </label>
          <input
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            id="employer-period-end"
            onChange={(e) => onPeriodEndChange(e.target.value)}
            type="date"
            value={periodEnd}
          />
        </div>
      </div>

      {validationError && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {validationError}
          </p>
        </div>
      )}
    </section>
  );
}
