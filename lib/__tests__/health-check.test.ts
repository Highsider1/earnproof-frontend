/**
 * @jest-environment jsdom
 */

import { renderHook, waitFor, act } from "@testing-library/react";
import { useHealthCheck } from "@/lib/health-check";

const HEALTH_OK = {
  status: "ok",
  service: "earnproof-api",
  database: "ok",
  timestamp: new Date().toISOString(),
};

const originalFetch = global.fetch;

beforeEach(() => {
  jest.useFakeTimers();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => HEALTH_OK,
  });
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe("useHealthCheck", () => {
  it("fetches health data on mount and transitions out of loading", async () => {
    const { result } = renderHook(() => useHealthCheck());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.status).toBe("ok");
    expect(result.current.data?.database).toBe("ok");
    expect(result.current.error).toBeNull();
    expect(result.current.lastChecked).toBeInstanceOf(Date);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it("returns error state on HTTP failure", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("HTTP 500");
  });

  it("returns error state on network failure", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new TypeError("Failed to fetch"),
    );

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to fetch");
  });

  it("returns error state on malformed response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ foo: "bar" }),
    });

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Malformed response");
  });

  it("returns error state when database is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        service: "earnproof-api",
        database: "error",
        timestamp: new Date().toISOString(),
      }),
    });

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Database: error");
  });

  it("returns error state when status is not ok", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "degraded",
        service: "earnproof-api",
        database: "ok",
        timestamp: new Date().toISOString(),
      }),
    });

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Status: degraded");
  });

  it("returns error state when timestamp is stale", async () => {
    const staleTimestamp = new Date(
      Date.now() - 120_000,
    ).toISOString();

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: "ok",
        service: "earnproof-api",
        database: "ok",
        timestamp: staleTimestamp,
      }),
    });

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Stale timestamp");
  });

  it("reports timeout on abort", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    const { result } = renderHook(() => useHealthCheck());

    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => {
      jest.advanceTimersByTime(10_000);
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Request timed out");
  });

  it("aborts the previous request when refetch is called", async () => {
    const abortSpy = jest.fn();
    let callCount = 0;

    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, init: RequestInit) => {
        callCount++;
        if (callCount === 1) {
          return new Promise((resolve) => {
            init?.signal?.addEventListener("abort", () => abortSpy());
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => HEALTH_OK,
                }),
              50_000,
            );
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => HEALTH_OK,
        });
      },
    );

    const { result } = renderHook(() => useHealthCheck(999_999));

    await waitFor(() => expect(result.current.loading).toBe(true));

    act(() => {
      result.current.refetch();
    });

    expect(abortSpy).toHaveBeenCalled();

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data?.status).toBe("ok");
  });

  it("sets up a polling interval", async () => {
    const { result } = renderHook(() => useHealthCheck(1000));

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCountBefore = (global.fetch as jest.Mock).mock.calls.length;

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() =>
      expect((global.fetch as jest.Mock).mock.calls.length).toBeGreaterThan(
        callCountBefore,
      ),
    );
  });
});
