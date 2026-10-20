import { act, renderHook, waitFor } from "@testing-library/react";
import { useApiData } from "./use-api-data";

const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

describe("useApiData cancellation pattern", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("updates state from a successful response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ id: 1, name: "test" }), { status: 200 }),
    );

    const { result } = renderHook(() => useApiData("http://api.test/data"));

    await waitFor(() => {
      expect(result.current.data).toEqual({ id: 1, name: "test" });
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("reports HTTP failures", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Not Found", { status: 404 }));

    const { result } = renderHook(() => useApiData("http://api.test/data"));

    await waitFor(() => {
      expect(result.current.error?.message).toBe("HTTP 404");
    });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("aborts an in-flight request on unmount", async () => {
    let capturedSignal: AbortSignal | undefined;
    fetchMock.mockImplementationOnce((_url, init?: RequestInit) => {
      capturedSignal = init?.signal ?? undefined;
      return new Promise(() => {});
    });

    const { unmount } = renderHook(() => useApiData("http://api.test/data"));

    await waitFor(() => expect(capturedSignal).toBeDefined());

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("aborts the previous request when the URL changes", async () => {
    const signals: AbortSignal[] = [];
    fetchMock.mockImplementation((_url, init?: RequestInit) => {
      if (init?.signal) {
        signals.push(init.signal);
      }
      return new Promise(() => {});
    });

    const { rerender } = renderHook(
      ({ url }) => useApiData(url),
      { initialProps: { url: "http://api.test/data/1" } },
    );

    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0].aborted).toBe(false);

    await act(async () => {
      rerender({ url: "http://api.test/data/2" });
    });

    await waitFor(() => expect(signals).toHaveLength(2));
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });
});
