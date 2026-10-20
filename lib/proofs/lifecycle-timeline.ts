/**
 * Normalizes a proof's lifecycle into an ordered list of timeline events
 * (#137). Built only from fields the API actually returns
 * (`ProofSummary.issuedAt` / `expiresAt` / `revokedAt`, and the
 * verification `status`/`result`) — there is no anchoring-transaction
 * timestamp or hash in the current API schema, so no "Anchored" event is
 * fabricated here. `#anchorTransactionHash` on `LifecycleEvent` is kept
 * optional so the type is ready for that field the day the backend adds
 * it, without this module claiming it exists today.
 */

export type LifecycleEventKind =
  | "issued"
  | "verified"
  | "pending"
  | "expired"
  | "revoked"
  | "failed";

export interface LifecycleEvent {
  kind: LifecycleEventKind;
  /** ISO timestamp, or null when the API provides no timestamp for this
   * event (e.g. a REVOKED proof whose `revokedAt` the API omitted). */
  at: string | null;
  label: string;
  /** Accessible description beyond the label — never color/icon-only,
   * per #137's "every state has accessible text" requirement. */
  description: string;
}

export interface ProofLifecycleInput {
  result:
    | "VALID"
    | "EXPIRED"
    | "REVOKED"
    | "INVALID_SIGNATURE"
    | "UNKNOWN_PROOF"
    | "UNVERIFIED_ISSUER";
  issuedAt?: string | null;
  expiresAt?: string | null;
  revokedAt?: string | null;
}

function toTimeOrNull(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Fixed rank per event kind, used to order events with equal or missing
 * timestamps deterministically (#137: "Timeline ordering is stable when
 * timestamps are equal or absent"). This is the lifecycle's natural
 * causal order: a proof cannot be verified before it is issued, cannot
 * expire before it is verified, etc.
 */
const KIND_ORDER: Record<LifecycleEventKind, number> = {
  issued: 0,
  verified: 1,
  pending: 2,
  expired: 3,
  revoked: 4,
  failed: 5,
};

export function buildProofLifecycleTimeline(input: ProofLifecycleInput): LifecycleEvent[] {
  const events: LifecycleEvent[] = [];

  if (input.issuedAt) {
    events.push({
      kind: "issued",
      at: input.issuedAt,
      label: "Issued",
      description: "The credential was signed and issued by the issuer.",
    });
  }

  switch (input.result) {
    case "VALID":
      events.push({
        kind: "verified",
        at: null, // "now": this verification itself has no persisted timestamp
        label: "Verified",
        description: "This proof was successfully verified and is currently valid.",
      });
      break;
    case "EXPIRED":
      events.push({
        kind: "expired",
        at: input.expiresAt ?? null,
        label: "Expired",
        description: "This proof has passed its expiration date and is no longer valid.",
      });
      break;
    case "REVOKED":
      events.push({
        kind: "revoked",
        at: input.revokedAt ?? null,
        label: "Revoked",
        description: "The issuer revoked this proof before its natural expiration.",
      });
      break;
    case "INVALID_SIGNATURE":
      events.push({
        kind: "failed",
        at: null,
        label: "Verification failed",
        description: "The cryptographic signature on this credential could not be verified.",
      });
      break;
    case "UNVERIFIED_ISSUER":
      events.push({
        kind: "failed",
        at: null,
        label: "Verification failed",
        description: "The issuer of this proof could not be verified.",
      });
      break;
    case "UNKNOWN_PROOF":
      events.push({
        kind: "pending",
        at: null,
        label: "Not found",
        description: "No lifecycle events are available for an unrecognized proof identifier.",
      });
      break;
  }

  // A VALID proof whose expiresAt has already passed hasn't been
  // re-verified since expiring (the API's own `result` reflects that
  // already), but if expiresAt is in the future, surface it as an
  // upcoming lifecycle event so an operator can see when to expect the
  // next transition even before it happens.
  if (input.result === "VALID" && input.expiresAt) {
    const expiresAtMs = toTimeOrNull(input.expiresAt);
    if (expiresAtMs !== null && expiresAtMs > Date.now()) {
      events.push({
        kind: "pending",
        at: input.expiresAt,
        label: "Expires",
        description: "This proof will stop being valid at this time unless renewed.",
      });
    }
  }

  return events.sort((a, b) => {
    const timeA = toTimeOrNull(a.at);
    const timeB = toTimeOrNull(b.at);

    // Both have real timestamps: sort chronologically.
    if (timeA !== null && timeB !== null && timeA !== timeB) {
      return timeA - timeB;
    }

    // One or both timestamps are equal or missing: fall back to the fixed
    // causal kind order, which is always stable regardless of timestamp
    // data quality.
    return KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  });
}
