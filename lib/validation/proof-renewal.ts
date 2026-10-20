import type { ProofListItem } from "@/lib/api/proofs-list";

export type RenewalEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

/**
 * Whether `predecessor` can be renewed by the given caller (#168).
 *
 * - Revoked proofs can never be renewed (a revoked credential's claim is
 *   no longer trusted; renewing it would launder a bad claim into a fresh
 *   one).
 * - Only the proof's own owner (issuerId match against the caller's own
 *   issuer/session identity) may renew it — "compatible proof types and
 *   owners" from the issue's Scope.
 * - Only the same proof type may be renewed into itself (a MINIMUM_INCOME
 *   proof renews into another MINIMUM_INCOME proof, never into a
 *   PAYMENT_RECEIPT) — renewal is meant to extend an existing claim's
 *   validity period, not change what's being claimed.
 * - A proof that already has a successor is not eligible again (checked by
 *   the caller via findSuccessorOf before calling this, since that's
 *   session/store state, not a property of the proof itself).
 */
export function checkRenewalEligibility(
  predecessor: ProofListItem,
  callerIssuerId: string,
): RenewalEligibility {
  if (predecessor.revokedAt !== null) {
    return { eligible: false, reason: "A revoked proof cannot be renewed." };
  }

  if (predecessor.issuerId !== callerIssuerId) {
    return {
      eligible: false,
      reason: "Only the issuer that created this proof can renew it.",
    };
  }

  if (predecessor.status === "REVOKED") {
    return { eligible: false, reason: "A revoked proof cannot be renewed." };
  }

  return { eligible: true };
}

export function isCompatibleRenewalType(
  predecessorType: ProofListItem["type"],
  successorType: ProofListItem["type"],
): boolean {
  return predecessorType === successorType;
}
