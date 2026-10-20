/**
 * @jest-environment jsdom
 */

import {
  CAPABILITY_CACHE_TTL_MS,
  clearCapabilityCache,
  isCapabilityCacheFresh,
  readCapabilityCache,
  writeCapabilityCache,
  type CachedCapabilityEntry,
} from "../capability-cache";
import {
  CAPABILITY_DOCUMENT_SHAPE_VERSION,
  type CapabilityDocument,
  type DeploymentIdentity,
} from "../capabilities";
import { API_SPEC_VERSION } from "../generated/v1";

const IDENTITY: DeploymentIdentity = {
  apiUrl: "http://localhost:4000/api/v1",
  stellarNetwork: "testnet",
  apiSpecVersion: API_SPEC_VERSION,
};

function document(overrides: Partial<CapabilityDocument> = {}): CapabilityDocument {
  return {
    documentVersion: CAPABILITY_DOCUMENT_SHAPE_VERSION,
    apiVersion: API_SPEC_VERSION,
    network: "testnet",
    generatedAt: new Date().toISOString(),
    capabilities: { "activity-log": { enabled: true } },
    ...overrides,
  };
}

function entry(overrides: Partial<CachedCapabilityEntry> = {}): CachedCapabilityEntry {
  return {
    document: document(),
    identity: IDENTITY,
    cachedAt: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("read/write/clear round trip", () => {
  it("returns null when nothing is cached", () => {
    expect(readCapabilityCache()).toBeNull();
  });

  it("round-trips a written entry", () => {
    const written = entry();
    writeCapabilityCache(written);
    expect(readCapabilityCache()).toEqual(written);
  });

  it("clears the cache", () => {
    writeCapabilityCache(entry());
    clearCapabilityCache();
    expect(readCapabilityCache()).toBeNull();
  });

  it("discards and returns null for malformed cached JSON", () => {
    window.localStorage.setItem("earnproof_capabilities", "{not-json");
    expect(readCapabilityCache()).toBeNull();
    // Malformed entry should have been swept, not left behind.
    expect(window.localStorage.getItem("earnproof_capabilities")).toBeNull();
  });

  it("discards and returns null for well-formed JSON missing required fields", () => {
    window.localStorage.setItem(
      "earnproof_capabilities",
      JSON.stringify({ document: {} }), // missing identity/cachedAt
    );
    expect(readCapabilityCache()).toBeNull();
  });
});

describe("isCapabilityCacheFresh — stale cache handling", () => {
  it("is fresh immediately after caching with unchanged identity", () => {
    const cached = entry({ cachedAt: Date.now() });
    expect(isCapabilityCacheFresh(cached, IDENTITY)).toBe(true);
  });

  it("is stale once the TTL has elapsed, even with unchanged identity", () => {
    const cachedAt = Date.now() - (CAPABILITY_CACHE_TTL_MS + 1);
    const cached = entry({ cachedAt });
    expect(isCapabilityCacheFresh(cached, IDENTITY)).toBe(false);
  });

  it("is fresh right at the boundary just under the TTL", () => {
    const cachedAt = Date.now() - (CAPABILITY_CACHE_TTL_MS - 1000);
    const cached = entry({ cachedAt });
    expect(isCapabilityCacheFresh(cached, IDENTITY)).toBe(true);
  });

  it("treats a cachedAt timestamp in the future as stale (clock skew/tamper guard)", () => {
    const cached = entry({ cachedAt: Date.now() + 60_000 });
    expect(isCapabilityCacheFresh(cached, IDENTITY)).toBe(false);
  });
});

describe("isCapabilityCacheFresh — invalidation on deployment identity change", () => {
  it("is stale when the API URL changes (e.g. pointed at a different backend)", () => {
    const cached = entry();
    expect(
      isCapabilityCacheFresh(cached, { ...IDENTITY, apiUrl: "https://new-api.example.com" }),
    ).toBe(false);
  });

  it("is stale when the Stellar network changes", () => {
    const cached = entry();
    expect(isCapabilityCacheFresh(cached, { ...IDENTITY, stellarNetwork: "public" })).toBe(
      false,
    );
  });

  it("is stale when the API spec version changes (incompatible version)", () => {
    const cached = entry();
    expect(
      isCapabilityCacheFresh(cached, { ...IDENTITY, apiSpecVersion: "2.0.0" }),
    ).toBe(false);
  });
});
