/**
 * The client error event contract, inspected on the serialized payload —
 * the only thing that actually leaves the browser.
 */

import {
  ALLOWED_EVENT_FIELDS,
  ERROR_CATEGORIES,
  SCHEMA_VERSION,
  isErrorCategory,
  serializeEvent,
  toAllowedErrorName,
} from "@/lib/telemetry/schema";
import {
  buildClientErrorEvent,
  categorizeError,
  reportClientError,
} from "@/lib/telemetry/client-error-reporter";
import { resetPageLoadId } from "@/lib/telemetry/correlation";
import {
  REPRESENTATIVE_ERRORS,
  SENSITIVE_VALUES,
  PROOF_ID,
  WALLET_ADDRESS,
} from "./fixtures/sensitive-values";

const ENDPOINT = "https://collector.test/errors";
const alwaysSample = { defaultRate: 1 };

function captureSent(input: Parameters<typeof reportClientError>[0]): string | null {
  let body: string | null = null;
  reportClientError(input, {
    endpoint: ENDPOINT,
    sampling: alwaysSample,
    transport: (_endpoint, payload) => {
      body = payload;
      return true;
    },
  });
  return body;
}

beforeEach(() => {
  resetPageLoadId();
});

describe("event field allow-list", () => {
  it("serializes exactly the allow-listed fields and nothing else", () => {
    const event = buildClientErrorEvent({
      error: new TypeError("Failed to fetch"),
      category: "api.network-unavailable",
      pathname: "/verify",
    });

    expect(Object.keys(serializeEvent(event as unknown as Record<string, unknown>)).sort()).toEqual(
      [...ALLOWED_EVENT_FIELDS].sort(),
    );
  });

  it("drops any field an upstream caller attaches to the event", () => {
    const serialized = serializeEvent({
      category: "unknown",
      walletAddress: WALLET_ADDRESS,
      proofId: PROOF_ID,
      stack: "at signProof (proofs.ts:42)",
      requestUrl: "https://api.earnproof.test/v1/proofs?proofId=EP-8A42-91DC",
      userId: "worker-42",
    });

    expect(Object.keys(serialized)).toEqual(["category"]);
  });

  it("never carries a raw message, stack, or URL field", () => {
    const body = captureSent({
      error: new Error("boom"),
      category: "runtime.uncaught-error",
      pathname: "/verify",
    });
    const parsed = JSON.parse(body as unknown as string);

    for (const forbidden of ["message", "stack", "url", "href", "userAgent", "userId"]) {
      expect(parsed).not.toHaveProperty(forbidden);
    }
  });
});

describe("stable error categories", () => {
  it("has a unique, non-empty vocabulary", () => {
    expect(new Set(ERROR_CATEGORIES).size).toBe(ERROR_CATEGORIES.length);
    expect(ERROR_CATEGORIES.every((category) => category.length > 0)).toBe(true);
  });

  it("recognises only its own categories", () => {
    expect(isErrorCategory("api.timeout")).toBe(true);
    expect(isErrorCategory("api.made-up")).toBe(false);
    expect(isErrorCategory(undefined)).toBe(false);
  });

  it("derives the category from the failure shape, never from its message", () => {
    const misleading = new Error("rate limited! server error! timeout!");
    expect(categorizeError(misleading)).toBe("unknown");

    expect(categorizeError(new DOMException("aborted", "AbortError"))).toBe("api.cancelled");
    expect(categorizeError(new TypeError("Failed to fetch"))).toBe("api.network-unavailable");
    expect(categorizeError(new Error("x"), { status: 429 })).toBe("api.rate-limited");
    expect(categorizeError(new Error("x"), { status: 503 })).toBe("api.server-error");
    expect(categorizeError(new Error("x"), { status: 404 })).toBe("api.client-error");
    expect(categorizeError(new Error("x"), { status: 504 })).toBe("api.timeout");
  });

  it("collapses a custom error class name to a platform name", () => {
    class WalletError extends Error {
      override name = `Wallet ${WALLET_ADDRESS} error`;
    }
    expect(toAllowedErrorName(new WalletError("nope").name)).toBe("Error");
    expect(toAllowedErrorName("TypeError")).toBe("TypeError");
  });

  it("stamps the schema version so consumers can migrate", () => {
    const parsed = JSON.parse(
      captureSent({
        error: new Error("boom"),
        category: "unknown",
        pathname: "/",
      }) as unknown as string,
    );
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
  });
});

describe("privacy of serialized events", () => {
  it.each(REPRESENTATIVE_ERRORS)("leaks nothing from: $label", ({ error }) => {
    const body = captureSent({
      error,
      category: categorizeError(error),
      pathname: `/verify?proof=${PROOF_ID}`,
    });

    expect(body).not.toBeNull();
    for (const value of SENSITIVE_VALUES) {
      expect(body).not.toContain(value);
    }
  });

  it("reduces the route to a known pattern and drops the query string", () => {
    const parsed = JSON.parse(
      captureSent({
        error: new Error("boom"),
        category: "unknown",
        pathname: `/verify?proof=${PROOF_ID}&token=abc`,
      }) as unknown as string,
    );
    expect(parsed.route).toBe("/verify");
  });

  it("collapses an unknown or dynamic route rather than reporting it verbatim", () => {
    const parsed = JSON.parse(
      captureSent({
        error: new Error("boom"),
        category: "unknown",
        pathname: `/proofs/${PROOF_ID}`,
      }) as unknown as string,
    );
    expect(parsed.route).toBe("/other");
    expect(parsed.route).not.toContain(PROOF_ID);
  });
});

describe("failure isolation", () => {
  const input = {
    error: new TypeError("Failed to fetch"),
    category: "api.network-unavailable" as const,
    pathname: "/verify",
  };

  it("does not report, and does not throw, when no endpoint is configured", () => {
    const transport = jest.fn();
    expect(reportClientError(input, { sampling: alwaysSample, transport })).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it("swallows a transport that throws", () => {
    expect(() =>
      reportClientError(input, {
        endpoint: ENDPOINT,
        sampling: alwaysSample,
        transport: () => {
          throw new Error("collector unreachable");
        },
      }),
    ).not.toThrow();
  });

  it("reports a rejected delivery as false rather than raising", () => {
    expect(
      reportClientError(input, {
        endpoint: ENDPOINT,
        sampling: alwaysSample,
        transport: () => false,
      }),
    ).toBe(false);
  });

  it("survives an error object that throws while being inspected", () => {
    const hostile = {
      get name() {
        throw new Error("nope");
      },
      get message() {
        throw new Error("nope");
      },
    };
    expect(() =>
      reportClientError(
        { error: hostile, category: "unknown", pathname: "/" },
        { endpoint: ENDPOINT, sampling: alwaysSample, transport: () => true },
      ),
    ).not.toThrow();
  });

  it("returns synchronously, so no caller can await it or be delayed by it", () => {
    const result = reportClientError(input, {
      endpoint: ENDPOINT,
      sampling: alwaysSample,
      transport: () => true,
    });
    expect(typeof result).toBe("boolean");
    expect(result).not.toHaveProperty("then");
  });

  it("does not report when the event is not sampled", () => {
    const transport = jest.fn();
    expect(
      reportClientError(input, {
        endpoint: ENDPOINT,
        sampling: { defaultRate: 0 },
        transport,
      }),
    ).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });

  it("never sends a correlation id as a credential", () => {
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      const body = captureSent(input);
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(body?.toLowerCase()).not.toContain("authorization");
      expect(body?.toLowerCase()).not.toContain("bearer");
    } finally {
      global.fetch = originalFetch;
    }
  });
});
