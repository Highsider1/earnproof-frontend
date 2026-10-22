"use client";

import { MAX_DATE_RANGE_DAYS, validateDateRange, type AuditLogFilters } from "@/lib/api/audit";

export function AuditLogFiltersForm({
  filters,
  onFiltersChange,
  disabled,
}: {
  filters: AuditLogFilters;
  onFiltersChange: (filters: AuditLogFilters) => void;
  disabled: boolean;
}) {
  const dateRangeError = validateDateRange(filters.dateFrom, filters.dateTo);

  function update<K extends keyof AuditLogFilters>(key: K, value: string) {
    onFiltersChange({ ...filters, [key]: value || undefined });
  }

  return (
    <fieldset className="grid gap-4" disabled={disabled}>
      <legend className="text-sm font-medium text-slate-200">Filters</legend>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Actor
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => update("actor", event.target.value)}
            type="text"
            value={filters.actor ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Action
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => update("action", event.target.value)}
            type="text"
            value={filters.action ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-slate-200">
          Resource
          <input
            className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            onChange={(event) => update("resource", event.target.value)}
            type="text"
            value={filters.resource ?? ""}
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            From
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-2 text-white"
              onChange={(event) => update("dateFrom", event.target.value)}
              type="date"
              value={filters.dateFrom ?? ""}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium text-slate-200">
            To
            <input
              className="h-11 w-full rounded-md border border-white/10 bg-slate-900 px-2 text-white"
              onChange={(event) => update("dateTo", event.target.value)}
              type="date"
              value={filters.dateTo ?? ""}
            />
          </label>
        </div>
      </div>
      {dateRangeError ? (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {dateRangeError}
          </p>
        </div>
      ) : (
        <p className="text-xs text-slate-400">Date range is limited to {MAX_DATE_RANGE_DAYS} days.</p>
      )}
    </fieldset>
  );
}
