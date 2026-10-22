import {
  listBackfillJobs,
  createBackfillJob,
  markBackfillRunning,
  markBackfillCompleted,
  markBackfillFailed,
  canCancelBackfill,
  cancelBackfillJob,
  ConflictingBackfillError,
  BackfillJobNotFoundError,
  CannotCancelRunningBackfillError,
} from "../store";

const USER_A = "user-a";
const USER_B = "user-b";

const RANGE_1 = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-10T00:00:00.000Z" };
const RANGE_2_OVERLAP = { rangeStart: "2026-06-05T00:00:00.000Z", rangeEnd: "2026-06-15T00:00:00.000Z" };
const RANGE_3_DISJOINT = { rangeStart: "2026-07-01T00:00:00.000Z", rangeEnd: "2026-07-10T00:00:00.000Z" };

beforeEach(() => {
  window.localStorage.clear();
});

describe("payment-backfill store", () => {
  it("creates a job in queued status", () => {
    const job = createBackfillJob(USER_A, RANGE_1);
    expect(job.status).toBe("queued");
    expect(job.result).toBeNull();
  });

  it("lists jobs newest first", () => {
    createBackfillJob(USER_A, RANGE_1);
    jest.useFakeTimers().setSystemTime(new Date(Date.now() + 1000));
    const second = createBackfillJob(USER_A, RANGE_3_DISJOINT);
    jest.useRealTimers();

    expect(listBackfillJobs(USER_A)[0]?.id).toBe(second.id);
  });

  it("rejects a new job whose range overlaps an active job (conflict state)", () => {
    createBackfillJob(USER_A, RANGE_1);

    expect(() => createBackfillJob(USER_A, RANGE_2_OVERLAP)).toThrow(ConflictingBackfillError);
  });

  it("allows a disjoint-range job while another is active", () => {
    createBackfillJob(USER_A, RANGE_1);

    expect(() => createBackfillJob(USER_A, RANGE_3_DISJOINT)).not.toThrow();
  });

  it("allows an overlapping job once the conflicting job is completed", () => {
    const first = createBackfillJob(USER_A, RANGE_1);
    markBackfillCompleted(USER_A, first.id, { created: 1, updated: 0, skipped: 0 });

    expect(() => createBackfillJob(USER_A, RANGE_2_OVERLAP)).not.toThrow();
  });

  it("allows an overlapping job once the conflicting job has failed", () => {
    const first = createBackfillJob(USER_A, RANGE_1);
    markBackfillFailed(USER_A, first.id, "boom");

    expect(() => createBackfillJob(USER_A, RANGE_2_OVERLAP)).not.toThrow();
  });

  it("scopes jobs and conflict detection per user", () => {
    createBackfillJob(USER_A, RANGE_1);

    expect(() => createBackfillJob(USER_B, RANGE_2_OVERLAP)).not.toThrow();
  });

  it("transitions queued -> running -> completed", () => {
    const job = createBackfillJob(USER_A, RANGE_1);

    markBackfillRunning(USER_A, job.id);
    const completed = markBackfillCompleted(USER_A, job.id, {
      created: 3,
      updated: 1,
      skipped: 0,
    });

    expect(completed.status).toBe("completed");
    expect(completed.result).toEqual({ created: 3, updated: 1, skipped: 0 });
  });

  it("transitions to failed with an error message", () => {
    const job = createBackfillJob(USER_A, RANGE_1);

    const failed = markBackfillFailed(USER_A, job.id, "network error");

    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("network error");
  });

  it("throws BackfillJobNotFoundError transitioning a missing job", () => {
    expect(() => markBackfillRunning(USER_A, "missing")).toThrow(BackfillJobNotFoundError);
  });

  it("allows cancellation only while queued (recovery/authorization case)", () => {
    const job = createBackfillJob(USER_A, RANGE_1);
    expect(canCancelBackfill(job)).toBe(true);

    const running = markBackfillRunning(USER_A, job.id);
    expect(canCancelBackfill(running)).toBe(false);
  });

  it("cancels a queued job", () => {
    const job = createBackfillJob(USER_A, RANGE_1);

    const cancelled = cancelBackfillJob(USER_A, job.id);

    expect(cancelled.status).toBe("failed");
    expect(cancelled.error).toBe("Cancelled by user");
  });

  it("refuses to cancel a running job", () => {
    const job = createBackfillJob(USER_A, RANGE_1);
    markBackfillRunning(USER_A, job.id);

    expect(() => cancelBackfillJob(USER_A, job.id)).toThrow(CannotCancelRunningBackfillError);
  });

  it("throws BackfillJobNotFoundError cancelling a missing job", () => {
    expect(() => cancelBackfillJob(USER_A, "missing")).toThrow(BackfillJobNotFoundError);
  });

  it("persists jobs across separate calls (page-refresh survival within the browser)", () => {
    const job = createBackfillJob(USER_A, RANGE_1);
    markBackfillRunning(USER_A, job.id);

    // A later, independent call (simulating a fresh page load reading
    // from localStorage) sees the same in-progress state.
    const reloaded = listBackfillJobs(USER_A).find((j) => j.id === job.id);
    expect(reloaded?.status).toBe("running");
  });

  it("discards a corrupted (non-array) stored value instead of throwing", () => {
    window.localStorage.setItem(
      "earnproof.payment-backfill.user-a",
      JSON.stringify({ not: "array" }),
    );

    expect(listBackfillJobs(USER_A)).toEqual([]);
  });
});
