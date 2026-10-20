import { discoverSigningKey, clearKeyDiscoveryCache } from "../registry";
import { STALE_DISCOVERY_THRESHOLD_MS } from "@/lib/validation/key-lifecycle";

describe("discoverSigningKey", () => {
  beforeEach(() => {
    clearKeyDiscoveryCache();
  });

  it("returns FOUND with an ACTIVE key for a known active proof type", () => {
    const outcome = discoverSigningKey("MinimumIncomeProof");
    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.key.lifecycleState).toBe("ACTIVE");
    }
  });

  it("returns FOUND with an OVERLAP_ROTATION key for PaymentReceiptProof", () => {
    const outcome = discoverSigningKey("PaymentReceiptProof");
    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.key.lifecycleState).toBe("OVERLAP_ROTATION");
    }
  });

  it("returns FOUND with a RETIRED key for LegacyProof", () => {
    const outcome = discoverSigningKey("LegacyProof");
    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.key.lifecycleState).toBe("RETIRED");
      expect(outcome.key.retiredAt).not.toBeNull();
    }
  });

  it("returns UNKNOWN_KEY for an unrecognized proof type", () => {
    expect(discoverSigningKey("SomeUnrecognizedProofType")).toEqual({ kind: "UNKNOWN_KEY" });
  });

  it("marks a freshly discovered key as not stale", () => {
    const outcome = discoverSigningKey("MinimumIncomeProof");
    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.isStale).toBe(false);
    }
  });

  it("marks a cached key as stale once the threshold has passed", () => {
    const start = Date.now();
    discoverSigningKey("MinimumIncomeProof", start);

    const later = start + STALE_DISCOVERY_THRESHOLD_MS + 1000;
    const outcome = discoverSigningKey("MinimumIncomeProof", later);

    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.isStale).toBe(true);
      expect(outcome.discoveredAt).toBe(new Date(start).toISOString());
    }
  });

  it("clearing the cache forces a fresh (non-stale) discovery again", () => {
    const start = Date.now();
    discoverSigningKey("MinimumIncomeProof", start);

    const later = start + STALE_DISCOVERY_THRESHOLD_MS + 1000;
    clearKeyDiscoveryCache();
    const outcome = discoverSigningKey("MinimumIncomeProof", later);

    expect(outcome.kind).toBe("FOUND");
    if (outcome.kind === "FOUND") {
      expect(outcome.isStale).toBe(false);
    }
  });
});
