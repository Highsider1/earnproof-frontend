import {
  isDiscoveryStale,
  type DiscoveredSigningKey,
  type KeyDiscoveryOutcome,
} from "@/lib/validation/key-lifecycle";

/**
 * Disclosed stand-in for a real key-discovery service: no such endpoint
 * exists (see lib/validation/key-lifecycle.ts), so this is a small,
 * fixed, client-local registry keyed by the credential's proof.type,
 * simulating what a JWKS-style discovery response would contain. It is
 * intentionally static (not persisted or mutable at runtime) since there
 * is no real backend for a user action to actually rotate or retire a key
 * against.
 */
const MOCK_KEY_REGISTRY: Record<string, DiscoveredSigningKey> = {
  MinimumIncomeProof: {
    keyId: "earnproof-issuer-key-2026-01",
    algorithm: "Ed25519",
    lifecycleState: "ACTIVE",
    trustSource: "EarnProof Issuer Registry",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
  },
  RecurringIncomeProof: {
    keyId: "earnproof-issuer-key-2026-01",
    algorithm: "Ed25519",
    lifecycleState: "ACTIVE",
    trustSource: "EarnProof Issuer Registry",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
  },
  PaymentReceiptProof: {
    keyId: "earnproof-issuer-key-2025-07",
    algorithm: "Ed25519",
    lifecycleState: "OVERLAP_ROTATION",
    trustSource: "EarnProof Issuer Registry",
    activatedAt: "2025-07-01T00:00:00.000Z",
    retiredAt: null,
  },
  LegacyProof: {
    keyId: "earnproof-issuer-key-2024-11",
    algorithm: "Ed25519",
    lifecycleState: "RETIRED",
    trustSource: "EarnProof Issuer Registry",
    activatedAt: "2024-11-01T00:00:00.000Z",
    retiredAt: "2025-07-01T00:00:00.000Z",
  },
};

type CacheEntry = { key: DiscoveredSigningKey; discoveredAt: string };

/**
 * Caches each proof type's discovery result in memory (per page session,
 * intentionally not localStorage - this is a runtime cache, not durable
 * state) so `isStale` reflects how long ago the value was actually
 * fetched, not the moment of the current call. A real discovery client
 * would cache a JWKS response the same way rather than re-fetching on
 * every verification.
 */
const discoveryCache = new Map<string, CacheEntry>();

export function clearKeyDiscoveryCache(): void {
  discoveryCache.clear();
}

/**
 * Looks up the signing key for a credential's proof type, using the cache
 * when present. Returns UNKNOWN_KEY for any proof type not in the
 * registry (there is no fallback/guessing), and DISCOVERY_UNAVAILABLE only
 * if the lookup itself throws (kept distinct from UNKNOWN_KEY so the UI
 * can tell "we checked and found nothing" apart from "we could not check
 * at all").
 */
export function discoverSigningKey(proofType: string, now: number = Date.now()): KeyDiscoveryOutcome {
  try {
    const cached = discoveryCache.get(proofType);
    if (cached) {
      return { kind: "FOUND", key: cached.key, discoveredAt: cached.discoveredAt, isStale: isDiscoveryStale(cached.discoveredAt, now) };
    }

    const key = MOCK_KEY_REGISTRY[proofType];
    if (!key) {
      return { kind: "UNKNOWN_KEY" };
    }

    const discoveredAt = new Date(now).toISOString();
    discoveryCache.set(proofType, { key, discoveredAt });
    return { kind: "FOUND", key, discoveredAt, isStale: false };
  } catch {
    return { kind: "DISCOVERY_UNAVAILABLE" };
  }
}
