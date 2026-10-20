/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useProofStatusPolling } from "@/lib/proof-status-polling";

const TOKEN = "test-token";
const PROOF_ID = "proof-1";

function response(status: string, overrides: Record<string, unknown> = {}) {
  return { result: "VALID", status, ...overrides };
}

const originalFetch = global.fetch;
let visibilityState = "visible";

function setHidden(hidden: boolean) {
  visibilityState = hidden ? "hidden" : "visible";
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => visibilityState === "hidden",
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  jest.useFakeTimers();
  visibilityState = "visible";
  Object.defineProperty(document, "hidden", {
    configurable: true,
    get: () => visibilityState === "hidden",
  });
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

function mockFetchOnce(status: string) {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => response(status),
  });
}

describe("useProofStatusPolling", () => {
  it("fetches on mount and reports the initial status", async () => {
    mockFetchOnce("valid");

    const { result } = renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.status).toBe("valid");
    expect(result.current.isTerminal).toBe(false);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("schedules exactly one more poll after a non-terminal result", async () => {
    mockFetchOnce("valid");
    renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    mockFetchOnce("valid");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("stops polling once a terminal status (revoked) is reached", async () => {
    mockFetchOnce("revoked");

    const { result } = renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(result.current.isTerminal).toBe(true));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("stops polling once a terminal status (expired) is reached", async () => {
    mockFetchOnce("expired");

    const { result } = renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(result.current.isTerminal).toBe(true));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not poll while the tab is hidden", async () => {
    mockFetchOnce("valid");
    renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    act(() => setHidden(true));

    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("resumes immediately when the tab becomes visible again", async () => {
    mockFetchOnce("valid");
    renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    act(() => setHidden(true));
    mockFetchOnce("valid");

    await act(async () => {
      setHidden(false);
      await jest.advanceTimersByTimeAsync(0);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("keeps the last confirmed data and backs off on a transient failure", async () => {
    mockFetchOnce("valid");
    const { result } = renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(result.current.data?.status).toBe("valid"));

    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("network error"));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });

    expect(result.current.error).toBe("network error");
    // Data from the last successful poll is preserved, not cleared.
    expect(result.current.data?.status).toBe("valid");

    // Next attempt should back off to 10s (2x base), not retry at 5s again.
    mockFetchOnce("valid");
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(2); // still only the failed one

    await act(async () => {
      await jest.advanceTimersByTimeAsync(5_000);
    });
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it("caps backoff delay at MAX_DELAY_MS across repeated failures", async () => {
    mockFetchOnce("valid");
    renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    // Backoff sequence after each failure: 10s, 20s, 40s, then capped at 60s
    // (BASE_DELAY_MS * 2^attempt, capped at MAX_DELAY_MS). Advance by
    // exactly each expected delay so a longer single jump can't trigger
    // more than one retry per iteration.
    const expectedDelays = [10_000, 20_000, 40_000, 60_000, 60_000];
    for (const delay of expectedDelays) {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error("fail"));
      await act(async () => {
        await jest.advanceTimersByTimeAsync(delay);
      });
    }

    // 1 initial + 5 retries, one per scheduled backoff above.
    expect(global.fetch).toHaveBeenCalledTimes(6);
  });

  it("aborts the in-flight request and stops the loop on unmount", async () => {
    mockFetchOnce("valid");
    const { unmount } = renderHook(() => useProofStatusPolling(PROOF_ID, TOKEN));
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    unmount();

    await act(async () => {
      await jest.advanceTimersByTimeAsync(120_000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("does not apply a stale response after proofId changes mid-request", async () => {
    let resolveFirst!: (v: unknown) => void;
    (global.fetch as jest.Mock).mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    );

    const { result, rerender } = renderHook(
      ({ proofId }) => useProofStatusPolling(proofId, TOKEN),
      { initialProps: { proofId: "proof-A" } },
    );

    mockFetchOnce("valid");
    rerender({ proofId: "proof-B" });
    await waitFor(() => expect(result.current.data?.status).toBe("valid"));

    // The first (proof-A) request finally resolves late; it must not
    // clobber proof-B's already-applied result.
    await act(async () => {
      resolveFirst({ ok: true, json: async () => response("revoked") });
      await Promise.resolve();
    });

    expect(result.current.data?.status).toBe("valid");
  });

  it("restarts exactly one fresh loop when proofId changes", async () => {
    mockFetchOnce("valid");
    const { rerender } = renderHook(
      ({ proofId }) => useProofStatusPolling(proofId, TOKEN),
      { initialProps: { proofId: "proof-A" } },
    );
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));

    mockFetchOnce("valid");
    rerender({ proofId: "proof-B" });
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));

    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining("proof-B"),
      expect.anything(),
    );
  });
});
