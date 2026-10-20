import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BackfillJobList } from "../backfill-job-list";
import { createBackfillJob, markBackfillRunning } from "@/lib/payment-backfill/store";
import { syncPayments } from "@/lib/api/payments";

jest.mock("@/lib/api/payments", () => ({
  syncPayments: jest.fn(),
}));
const mockSyncPayments = syncPayments as jest.MockedFunction<typeof syncPayments>;

const USER_ID = "user-1";
const TOKEN = "tok";
const RANGE = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-10T00:00:00.000Z" };

beforeEach(() => {
  window.localStorage.clear();
  mockSyncPayments.mockReset();
});

describe("BackfillJobList", () => {
  it("shows an empty state when there are no jobs", () => {
    render(
      <BackfillJobList userId={USER_ID} token={TOKEN} jobs={[]} onJobsChanged={jest.fn()} />,
    );

    expect(screen.getByText("No backfill jobs yet. Request one above.")).toBeInTheDocument();
  });

  it("runs a queued job and shows completed status with counts on success", async () => {
    const job = createBackfillJob(USER_ID, RANGE);
    mockSyncPayments.mockResolvedValue({ created: 2, updated: 1, skipped: 0 });
    const onChanged = jest.fn();

    render(
      <BackfillJobList
        userId={USER_ID}
        token={TOKEN}
        jobs={[job]}
        onJobsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run now" }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith([
        expect.objectContaining({ status: "completed" }),
      ]);
    });
  });

  it("marks a job as failed when the sync call rejects (recovery case)", async () => {
    const job = createBackfillJob(USER_ID, RANGE);
    mockSyncPayments.mockRejectedValue(new Error("network down"));
    const onChanged = jest.fn();

    render(
      <BackfillJobList
        userId={USER_ID}
        token={TOKEN}
        jobs={[job]}
        onJobsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Run now" }));

    await waitFor(() => {
      expect(onChanged).toHaveBeenCalledWith([
        expect.objectContaining({ status: "failed", error: "network down" }),
      ]);
    });
  });

  it("offers Cancel only for a queued job, not a running one (authorization/safety case)", () => {
    const queued = createBackfillJob(USER_ID, RANGE);
    const runningJob = markBackfillRunning(
      USER_ID,
      createBackfillJob(USER_ID, { rangeStart: "2026-07-01T00:00:00.000Z", rangeEnd: "2026-07-05T00:00:00.000Z" }).id,
    );

    render(
      <BackfillJobList
        userId={USER_ID}
        token={TOKEN}
        jobs={[queued, runningJob]}
        onJobsChanged={jest.fn()}
      />,
    );

    expect(screen.getAllByRole("button", { name: "Cancel" })).toHaveLength(1);
  });

  it("cancels a queued job", () => {
    const job = createBackfillJob(USER_ID, RANGE);
    const onChanged = jest.fn();

    render(
      <BackfillJobList
        userId={USER_ID}
        token={TOKEN}
        jobs={[job]}
        onJobsChanged={onChanged}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onChanged).toHaveBeenCalledWith([
      expect.objectContaining({ status: "failed", error: "Cancelled by user" }),
    ]);
  });

  it("does not offer Run or Cancel actions for a completed job", () => {
    const job = createBackfillJob(USER_ID, RANGE);
    const completed = { ...job, status: "completed" as const, result: { created: 1, updated: 0, skipped: 0 } };

    render(
      <BackfillJobList
        userId={USER_ID}
        token={TOKEN}
        jobs={[completed]}
        onJobsChanged={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Run now" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cancel" })).not.toBeInTheDocument();
  });
});
