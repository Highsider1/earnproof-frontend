import { isBlockingKeyOutcome, isDiscoveryStale, STALE_DISCOVERY_THRESHOLD_MS } from "../key-lifecycle";

describe("isBlockingKeyOutcome", () => {
  it("is not blocking for a FOUND, ACTIVE key", () => {
    const outcome = {
      kind: "FOUND" as const,
      key: {
        keyId: "key-1",
        algorithm: "Ed25519",
        lifecycleState: "ACTIVE" as const,
        trustSource: "Registry",
        activatedAt: "2026-01-01T00:00:00.000Z",
        retiredAt: null,
      },
      discoveredAt: "2026-01-01T00:00:00.000Z",
      isStale: false,
    };
    expect(isBlockingKeyOutcome(outcome)).toBe(false);
  });

  it("is blocking for a FOUND key with UNKNOWN lifecycle state", () => {
    const outcome = {
      kind: "FOUND" as const,
      key: {
        keyId: "key-1",
        algorithm: "Ed25519",
        lifecycleState: "UNKNOWN" as const,
        trustSource: "Registry",
        activatedAt: "2026-01-01T00:00:00.000Z",
        retiredAt: null,
      },
      discoveredAt: "2026-01-01T00:00:00.000Z",
      isStale: false,
    };
    expect(isBlockingKeyOutcome(outcome)).toBe(true);
  });

  it("is blocking for UNKNOWN_KEY", () => {
    expect(isBlockingKeyOutcome({ kind: "UNKNOWN_KEY" })).toBe(true);
  });

  it("is blocking for DISCOVERY_UNAVAILABLE", () => {
    expect(isBlockingKeyOutcome({ kind: "DISCOVERY_UNAVAILABLE" })).toBe(true);
  });

  it("is not blocking for a FOUND, RETIRED key (retired is shown, not blocked)", () => {
    const outcome = {
      kind: "FOUND" as const,
      key: {
        keyId: "key-1",
        algorithm: "Ed25519",
        lifecycleState: "RETIRED" as const,
        trustSource: "Registry",
        activatedAt: "2024-01-01T00:00:00.000Z",
        retiredAt: "2025-01-01T00:00:00.000Z",
      },
      discoveredAt: "2026-01-01T00:00:00.000Z",
      isStale: false,
    };
    expect(isBlockingKeyOutcome(outcome)).toBe(false);
  });
});

describe("isDiscoveryStale", () => {
  it("returns false immediately after discovery", () => {
    const now = Date.now();
    expect(isDiscoveryStale(new Date(now).toISOString(), now)).toBe(false);
  });

  it("returns false just under the threshold", () => {
    const now = Date.now();
    const discoveredAt = new Date(now - STALE_DISCOVERY_THRESHOLD_MS + 1000).toISOString();
    expect(isDiscoveryStale(discoveredAt, now)).toBe(false);
  });

  it("returns true just over the threshold", () => {
    const now = Date.now();
    const discoveredAt = new Date(now - STALE_DISCOVERY_THRESHOLD_MS - 1000).toISOString();
    expect(isDiscoveryStale(discoveredAt, now)).toBe(true);
  });

  it("returns true for a discovery from days ago", () => {
    const now = Date.now();
    const discoveredAt = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    expect(isDiscoveryStale(discoveredAt, now)).toBe(true);
  });
});
