/**
 * No signing-key, JWKS, or key-discovery endpoint/schema exists anywhere in
 * the OpenAPI spec (#184 has no backend support at all) - a verified
 * credential's `proof.type`/`credentialHash`/`signature` fields identify a
 * proof scheme, not a signing key. This module defines the shape a real
 * "verified discovery response" would have, matching #184's own framing
 * ("key details come from the verified discovery response"), so the UI has
 * something real to render and test against while that endpoint does not
 * exist yet; lib/key-lifecycle/registry.ts supplies the (disclosed,
 * client-local) mock data behind it.
 */

export type KeyLifecycleState = "ACTIVE" | "OVERLAP_ROTATION" | "RETIRED" | "UNKNOWN";

export type KeyDiscoveryOutcome =
  | { kind: "FOUND"; key: DiscoveredSigningKey; discoveredAt: string; isStale: boolean }
  | { kind: "UNKNOWN_KEY" }
  | { kind: "DISCOVERY_UNAVAILABLE" };

export type DiscoveredSigningKey = {
  keyId: string;
  algorithm: string;
  lifecycleState: KeyLifecycleState;
  trustSource: string;
  activatedAt: string;
  retiredAt: string | null;
};

/**
 * A mismatch between the credential's proof type and the key that
 * discovery actually returns is not exposed at all: the caller only ever
 * gets the key that was found for the id looked up, or an outcome that
 * makes clear nothing usable was found. There is deliberately no code path
 * that returns a key for the "wrong" credential, so an unknown or
 * mismatched key can only ever surface as UNKNOWN_KEY, which the UI must
 * treat as blocking (#184's "unknown or mismatched keys produce a blocking
 * result").
 */
export function isBlockingKeyOutcome(outcome: KeyDiscoveryOutcome): boolean {
  return outcome.kind !== "FOUND" || outcome.key.lifecycleState === "UNKNOWN";
}

/**
 * A discovery result older than this is treated as stale and visibly
 * flagged rather than presented as current (#184's "stale cached key sets
 * are visibly identified").
 */
export const STALE_DISCOVERY_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

export function isDiscoveryStale(discoveredAt: string, now: number = Date.now()): boolean {
  return now - new Date(discoveredAt).getTime() > STALE_DISCOVERY_THRESHOLD_MS;
}
