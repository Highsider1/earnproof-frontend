import {
  fetchWithTimeout,
  isRetryable,
  retryMutation,
  retryRead,
} from "@/lib/api/client";

const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

function neverResolvingFetch(): Promise<Response> {
  return new Promise(() => {});
}

function abortingFetch(_url: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

describe("API timeout, retry, and cancellation", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("resolves a fetch that completes before the timeout", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"ok":true}', { status: 200 }));

    const response = await fetchWithTimeout("http://api.test/data", {
      timeoutMs: 5_000,
    });

    expect(response.status).toBe(200);
  });

  it("aborts a request after the configured timeout", async () => {
    fetchMock.mockImplementationOnce(abortingFetch);

    await expect(
      fetchWithTimeout("http://api.test/data", { timeoutMs: 1 }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("aborts when the caller signal is cancelled first", async () => {
    fetchMock.mockImplementationOnce(abortingFetch);
    const controller = new AbortController();

    const request = fetchWithTimeout("http://api.test/data", {
      signal: controller.signal,
      timeoutMs: 5_000,
    });
    controller.abort();

    await expect(request).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses the default timeout when the caller does not provide one", async () => {
    const setTimeoutSpy = jest.spyOn(global, "setTimeout");
    fetchMock.mockImplementationOnce(neverResolvingFetch);

    void fetchWithTimeout("http://api.test/data").catch(() => undefined);

    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10_000);
  });

  it("retries retryable network failures for reads", async () => {
    const fn = jest
      .fn<Promise<string>, [AbortSignal]>()
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockRejectedValueOnce(new TypeError("network error"))
      .mockResolvedValueOnce("success");

    await expect(retryRead(fn, new AbortController().signal, 3, 0)).resolves.toBe(
      "success",
    );
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("does not retry reads after the caller has aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const fn = jest
      .fn<Promise<string>, [AbortSignal]>()
      .mockRejectedValue(new TypeError("network error"));

    await expect(retryRead(fn, controller.signal, 3, 0)).rejects.toThrow(
      "network error",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not retry mutations automatically", async () => {
    const fn = jest
      .fn<Promise<string>, [AbortSignal]>()
      .mockRejectedValue(new TypeError("network error"));

    await expect(retryMutation(fn, new AbortController().signal)).rejects.toThrow(
      "network error",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it.each([
    [429, true],
    [503, true],
    [504, true],
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [500, false],
  ])("classifies HTTP %s retryability", (status, expected) => {
    expect(isRetryable(undefined, new Response("", { status }))).toBe(expected);
  });

  it("classifies aborted and network errors correctly", () => {
    expect(isRetryable(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isRetryable(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryable(new Error("Validation failed"))).toBe(false);
  });
});
