/**
 * Bounded payment rescan/backfill job tracking (#171).
 *
 * POST /payments/sync is the only real backend endpoint here, and it takes
 * no parameters: it always runs a full, unbounded, synchronous sync with
 * no concept of a ledger/time range, an async job, or resumable progress
 * (see lib/api/payments.ts's syncPayments doc comment). This store layers
 * the bounded-range request lifecycle #171 actually asks for
 * (queued/running/checkpointed/completed/failed, one-at-a-time conflict
 * detection, page-refresh persistence) on top of that call, persisted in
 * localStorage per user. It is a client-local stand-in for real
 * server-tracked job state; the store's function signatures are the
 * intended drop-in target if a real backfill-job endpoint is added later.
 *
 * "Progress survives page refresh through server state" cannot be
 * satisfied literally without server-tracked jobs; this persists to
 * localStorage instead, which survives a refresh in the same browser
 * (not across devices) — the closest honest approximation available.
 */
import { rangesOverlap } from "@/lib/validation/payment-backfill";

const STORAGE_KEY_PREFIX = "earnproof.payment-backfill.";

export type BackfillJobStatus =
  | "queued"
  | "running"
  | "checkpointed"
  | "completed"
  | "failed";

export interface BackfillJobRecord {
  id: string;
  rangeStart: string;
  rangeEnd: string;
  status: BackfillJobStatus;
  createdAt: string;
  updatedAt: string;
  result: { created: number; updated: number; skipped: number } | null;
  error: string | null;
}

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isBackfillJobRecord(value: unknown): value is BackfillJobRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.rangeStart === "string" &&
    typeof r.rangeEnd === "string" &&
    typeof r.status === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

function readAll(userId: string): BackfillJobRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isBackfillJobRecord);
  } catch {
    return [];
  }
}

function writeAll(userId: string, records: BackfillJobRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

const ACTIVE_STATUSES: BackfillJobStatus[] = ["queued", "running", "checkpointed"];

function isActive(job: BackfillJobRecord): boolean {
  return ACTIVE_STATUSES.includes(job.status);
}

export function listBackfillJobs(userId: string): BackfillJobRecord[] {
  return readAll(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class ConflictingBackfillError extends Error {
  constructor(readonly conflictingJobId: string) {
    super("A backfill job for an overlapping range is already active");
    this.name = "ConflictingBackfillError";
  }
}

/**
 * Queues a new backfill job. Rejects if any currently-active job's range
 * overlaps the requested one (#171's "only one conflicting backfill can be
 * requested at a time" — non-overlapping ranges may run concurrently).
 */
export function createBackfillJob(
  userId: string,
  input: { rangeStart: string; rangeEnd: string },
): BackfillJobRecord {
  const records = readAll(userId);
  const conflict = records.find((job) => isActive(job) && rangesOverlap(job, input));
  if (conflict) {
    throw new ConflictingBackfillError(conflict.id);
  }

  const now = new Date().toISOString();
  const job: BackfillJobRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `backfill_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    rangeStart: input.rangeStart,
    rangeEnd: input.rangeEnd,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    result: null,
    error: null,
  };
  records.push(job);
  writeAll(userId, records);
  return job;
}

export class BackfillJobNotFoundError extends Error {
  constructor(id: string) {
    super(`Backfill job ${id} not found`);
    this.name = "BackfillJobNotFoundError";
  }
}

function updateJob(
  userId: string,
  id: string,
  patch: Partial<Omit<BackfillJobRecord, "id" | "createdAt">>,
): BackfillJobRecord {
  const records = readAll(userId);
  const index = records.findIndex((j) => j.id === id);
  if (index === -1) {
    throw new BackfillJobNotFoundError(id);
  }
  const updated: BackfillJobRecord = {
    ...records[index]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  records[index] = updated;
  writeAll(userId, records);
  return updated;
}

export function markBackfillRunning(userId: string, id: string): BackfillJobRecord {
  return updateJob(userId, id, { status: "running" });
}

export function markBackfillCompleted(
  userId: string,
  id: string,
  result: { created: number; updated: number; skipped: number },
): BackfillJobRecord {
  return updateJob(userId, id, { status: "completed", result, error: null });
}

export function markBackfillFailed(userId: string, id: string, error: string): BackfillJobRecord {
  return updateJob(userId, id, { status: "failed", error });
}

/**
 * Cancellation is only offered when the backend reports it is safe
 * (#171's own acceptance criterion) — since the real sync call is a single
 * synchronous request with no cancel primitive, cancellation is only ever
 * safe for a job still "queued" (not yet started), never once "running".
 */
export function canCancelBackfill(job: BackfillJobRecord): boolean {
  return job.status === "queued";
}

export class CannotCancelRunningBackfillError extends Error {
  constructor() {
    super("This backfill is already running and cannot be safely cancelled");
    this.name = "CannotCancelRunningBackfillError";
  }
}

export function cancelBackfillJob(userId: string, id: string): BackfillJobRecord {
  const records = readAll(userId);
  const job = records.find((j) => j.id === id);
  if (!job) {
    throw new BackfillJobNotFoundError(id);
  }
  if (!canCancelBackfill(job)) {
    throw new CannotCancelRunningBackfillError();
  }
  return updateJob(userId, id, { status: "failed", error: "Cancelled by user" });
}
