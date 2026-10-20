import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateBackfillForm } from "../create-backfill-form";

const USER_ID = "user-1";
const NOW = "2026-06-15T00:00:00.000Z";

beforeEach(() => {
  window.localStorage.clear();
  jest.useFakeTimers().setSystemTime(new Date(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("CreateBackfillForm", () => {
  it("requests a backfill for a valid range and calls onJobCreated", async () => {
    const onJobCreated = jest.fn();
    render(<CreateBackfillForm userId={USER_ID} onJobCreated={onJobCreated} />);

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-06-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-10T00:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request backfill" }));

    await waitFor(() => {
      expect(onJobCreated).toHaveBeenCalledWith(
        expect.objectContaining({ status: "queued" }),
      );
    });
  });

  it("shows the estimated scope in days before submitting", () => {
    render(<CreateBackfillForm userId={USER_ID} onJobCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-06-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-10T00:00" },
    });

    expect(screen.getByText(/Estimated scope: 9 days/)).toBeInTheDocument();
  });

  it("rejects a range exceeding the maximum span (boundary/negative case)", async () => {
    const onJobCreated = jest.fn();
    render(<CreateBackfillForm userId={USER_ID} onJobCreated={onJobCreated} />);

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-01-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-01T00:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request backfill" }));

    await waitFor(() => {
      expect(onJobCreated).not.toHaveBeenCalled();
    });
  });

  it("rejects a range ending in the future (boundary case)", async () => {
    const onJobCreated = jest.fn();
    render(<CreateBackfillForm userId={USER_ID} onJobCreated={onJobCreated} />);

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-06-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-20T00:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request backfill" }));

    await waitFor(() => {
      expect(onJobCreated).not.toHaveBeenCalled();
    });
  });

  it("shows a conflict message when an active job's range overlaps (conflict state)", async () => {
    const onJobCreated = jest.fn();
    render(<CreateBackfillForm userId={USER_ID} onJobCreated={onJobCreated} />);

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-06-01T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-10T00:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request backfill" }));
    await waitFor(() => expect(onJobCreated).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText("Range start"), {
      target: { value: "2026-06-05T00:00" },
    });
    fireEvent.change(screen.getByLabelText("Range end"), {
      target: { value: "2026-06-12T00:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Request backfill" }));

    await waitFor(() => {
      expect(screen.getByText(/already in progress/i)).toBeInTheDocument();
    });
    expect(onJobCreated).toHaveBeenCalledTimes(1);
  });
});
