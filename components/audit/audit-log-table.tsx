"use client";

import { formatDateTime } from "@/lib/i18n";
import type { AuditLogEntry } from "@/lib/api/audit";

export function AuditLogTable({
  entries,
  loading,
  hasMore,
  onLoadMore,
}: {
  entries: AuditLogEntry[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}) {
  if (loading && entries.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading audit log...</p>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">No audit log entries match these filters.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="hidden grid-cols-[1fr_1fr_1fr_1fr] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
        <div>Actor</div>
        <div>Action</div>
        <div>Resource</div>
        <div>Occurred</div>
      </div>

      {entries.map((entry) => (
        <div
          className="grid gap-2 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[1fr_1fr_1fr_1fr] md:items-center md:gap-4"
          key={entry.id}
        >
          <div className="min-w-0 break-all text-white">{entry.actor}</div>
          <div className="text-slate-300">{entry.action}</div>
          <div className="min-w-0 break-all text-slate-300">{entry.resource}</div>
          <div className="text-slate-400">{formatDateTime(entry.occurredAt)}</div>
        </div>
      ))}

      {hasMore && (
        <button
          className="h-10 w-fit rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={onLoadMore}
          type="button"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
