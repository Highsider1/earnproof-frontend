/**
 * The workflow-isolation criterion, exercised through the real call path:
 * `apiClient` reports failures via `lib/telemetry`, and telemetry going
 * wrong must be invisible to the caller.
 *
 * These tests deliberately use the *default* beacon transport rather than an
 * injected one, so the isolation being proven is the one that ships.
 */

import { apiClient } from "@/lib/api/client";
import { PROOF_ID, WALLET_ADDRESS } from "./fixtures/sensitive-values";

const ENDPOINT = "https://collector.test/errors";

const originalFetch = global.fetch;
const originalEnv = { ...process.env };

function useBeacon(implementation: (url: string, body?: BodyInit | null) => boolean) {
  Object.defineProperty(window.navigator, "sendBeacon", {
    configurable: true,
    writable: true,
    value: jest.fn(implementation),
  });
  return window.navigator.sendBeacon as unknown as jest.Mock;
}

/** jsdom's Blob has no `text()`; read it the way a browser without it would. */
function readBlob(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_ERROR_TELEMETRY_ENDPOINT = ENDPOINT;
  process.env.NEXT_PUBLIC_ERROR_TELEMETRY_SAMPLE_RATE = "1";
});

afterEach(() => {
  global.fetch = originalFetch;
  process.env = { ...originalEnv };
  jest.restoreAllMocks();
});

describe("apiClient telemetry integration", () => {
  it("rejects with the original network error, unchanged", async () => {
    const beacon = useBeacon(() => true);
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as never;

    await expect(apiClient({ path: "/health" })).rejects.toThrow("Failed to fetch");
    expect(beacon).toHaveBeenCalledTimes(1);
  });

  it("rejects with the original HTTP failure, unchanged", async () => {
    useBeacon(() => true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 503,
      json: async () => ({}),
    }) as never;

    await expect(apiClient({ path: "/health" })).rejects.toThrow(
      "EarnProof API request failed with 503",
    );
  });

  it("does not change the failure when the telemetry transport throws", async () => {
    useBeacon(() => {
      throw new Error("collector unreachable");
    });
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as never;

    await expect(apiClient({ path: "/health" })).rejects.toThrow("Failed to fetch");
  });

  it("does not change the failure when the browser has no sendBeacon at all", async () => {
    Object.defineProperty(window.navigator, "sendBeacon", {
      configurable: true,
      writable: true,
      value: undefined,
    });
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    }) as never;

    await expect(apiClient({ path: "/health" })).rejects.toThrow(
      "EarnProof API request failed with 500",
    );
  });

  it("returns the parsed body on success and reports nothing", async () => {
    const beacon = useBeacon(() => true);
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok" }),
    }) as never;

    await expect(apiClient({ path: "/health" })).resolves.toEqual({ status: "ok" });
    expect(beacon).not.toHaveBeenCalled();
  });

  it("reports nothing at all when no endpoint is configured", async () => {
    delete process.env.NEXT_PUBLIC_ERROR_TELEMETRY_ENDPOINT;
    const beacon = useBeacon(() => true);
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch")) as never;

    await expect(apiClient({ path: "/health" })).rejects.toThrow("Failed to fetch");
    expect(beacon).not.toHaveBeenCalled();
  });

  it("sends no request detail that could identify the user or the proof", async () => {
    const bodies: Blob[] = [];
    useBeacon((_url, body) => {
      bodies.push(body as Blob);
      return true;
    });
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError(`Failed to fetch ${WALLET_ADDRESS} ${PROOF_ID}`)) as never;

    await expect(apiClient({ path: `/proofs/${PROOF_ID}` })).rejects.toThrow();

    // The beacon body is a Blob; read it back and assert on the bytes that
    // would actually have been transmitted.
    expect(bodies).toHaveLength(1);
    const sent = await readBlob(bodies[0]);
    expect(sent).not.toContain(WALLET_ADDRESS);
    expect(sent).not.toContain(PROOF_ID);
  });
});
