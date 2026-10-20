"use client";

import { useCallback, useState } from "react";
import { StatusBadge } from "@/components/common/production-ui";
import { syncPayments } from "@/lib/api/payments";
import {
  markBackfillRunning,
  markBackfillCompleted,
  markBackfillFailed,
  cancelBackfillJob,
  canCancelBackfill,
  type BackfillJobRecord,
} from "@/lib/payment-backfill/store";
import { formatDateTime } from "@/lib/i18n";

function statusTone(status: BackfillJobRecord["status"]): "success" | "warning" | "accent" {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "warning";
    case "running":
    case "checkpointed":
      return "accent";
    default:
      return "accent";
  }
}

export function BackfillJobList({
  userId,
  token,
  jobs,
  onJobsChanged,
}: {
  userId: string;
  token: string;
  jobs: BackfillJobRecord[];
  onJobsChanged: (jobs: BackfillJobRecord[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);

  const handleRun = useCallback(
    async (job: BackfillJobRecord) => {
      setError(null);
      setRunningJobId(job.id);
      try {
        markBackfillRunning(userId, job.id);
        const controller = new AbortController();
        const result = await syncPayments(token, controller.signal);
        const completed = markBackfillCompleted(userId, job.id, result);
        onJobsChanged(jobs.map((j) => (j.id === completed.id ? completed : j)));
      } catch (err) {
        const failed = markBackfillFailed(
          userId,
          job.id,
          err instanceof Error ? err.message : "Sync failed",
        );
        onJobsChanged(jobs.map((j) => (j.id === failed.id ? failed : j)));
        setError("Backfill failed. See the job's error for details.");
      } finally {
        setRunningJobId(null);
      }
    },
    [userId, token, jobs, onJobsChanged],
  );

  const handleCancel = useCallback(
    (job: BackfillJobRecord) => {
      setError(null);
      try {
        const cancelled = cancelBackfillJob(userId, job.id);
        onJobsChanged(jobs.map((j) => (j.id === cancelled.id ? cancelled : j)));
      } catch {
        setError("Unable to cancel this backfill. It may already be running.");
      }
    },
    [userId, jobs, onJobsChanged],
  );

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">No backfill jobs yet. Request one above.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {error}
          </p>
        </div>
      )}

      <div className="hidden grid-cols-[2fr_1fr_1fr_1.5fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
        <div>Range</div>
        <div>Status</div>
        <div>Requested</div>
        <div>Result</div>
        <div>Actions</div>
      </div>

      {jobs.map((job) => (
        <div
          key={job.id}
          className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[2fr_1fr_1fr_1.5fr_auto] md:items-center md:gap-4"
        >
          <div className="min-w-0 font-mono text-xs text-slate-300">
            {formatDateTime(job.rangeStart)} - {formatDateTime(job.rangeEnd)}
          </div>
          <div>
            <StatusBadge tone={statusTone(job.status)}>{job.status}</StatusBadge>
          </div>
          <div className="text-slate-400">{formatDateTime(job.createdAt)}</div>
          <div className="text-slate-300">
            {job.status === "completed" && job.result ? (
              <span>
                +{job.result.created} / ~{job.result.updated} / ={job.result.skipped}
              </span>
            ) : job.status === "failed" && job.error ? (
              <span className="text-rose-300">{job.error}</span>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </div>
          <div className="flex gap-2">
            {job.status === "queued" && (
              <>
                <button
                  onClick={() => void handleRun(job)}
                  disabled={runningJobId === job.id}
                  className="h-8 rounded border border-cyan-300/30 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/10 transition disabled:opacity-50"
                  type="button"
                >
                  {runningJobId === job.id ? "Running..." : "Run now"}
                </button>
                {canCancelBackfill(job) && (
                  <button
                    onClick={() => handleCancel(job)}
                    className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 transition"
                    type="button"
                  >
                    Cancel
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
