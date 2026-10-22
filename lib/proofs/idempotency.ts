/**
 * Idempotency-key lifecycle shared by every proof-creation request
 * (minimum-income, recurring-income, aggregate-earnings, income-range).
 *
 * The backend contract for these POST /proofs/* endpoints does not yet
 * define an Idempotency-Key header (see lib/api/openapi/earnproof-api.v1.json)
 * — this is deliberately forward-compatible and defense-in-depth on the
 * frontend side: sending a stable key for retries of the same submission
 * intent is harmless if the backend ignores the header today, and lets it
 * dedupe safely the moment it starts honoring one, without a frontend
 * change. It does not, by itself, guarantee server-side deduplication.
 *
 * `ProofIntent` is intentionally just "a JSON-serializable record" rather
 * than one fixed shape: each proof type's submission payload differs
 * (thresholdAmount vs. lower/upperBound vs. sources+policy), but all of them
 * need the same treatment — a stable signature that a same-intent retry can
 * be recognized by. `selectedPaymentIds`/`sourceIds`, if present, are
 * sorted so key ordering in a caller's selection doesn't change the
 * signature; every other field is compared as-is.
 */
export type ProofIntent = Record<string, unknown>;

export type IdempotencyState = {
  key: string;
  signature: string;
};

const ORDER_INSENSITIVE_ARRAY_FIELDS = ["selectedPaymentIds", "sourceIds"];

/** Stable across the listed array fields' ordering; changes if any field of the intent changes. */
export function intentSignature(intent: ProofIntent): string {
  const normalized: Record<string, unknown> = {};
  for (const key of Object.keys(intent).sort()) {
    const value = intent[key];
    normalized[key] =
      ORDER_INSENSITIVE_ARRAY_FIELDS.includes(key) && Array.isArray(value)
        ? [...value].sort()
        : value ?? null;
  }
  return JSON.stringify(normalized);
}

function generateKey(): string {
  const cryptoObj: Crypto | undefined =
    typeof crypto !== "undefined" ? crypto : undefined;
  if (cryptoObj && "randomUUID" in cryptoObj) {
    return cryptoObj.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID (older browsers,
  // some test environments). Not cryptographically strong, and doesn't
  // need to be — this only needs to be unique enough to correlate retries
  // of one submission, not to be unguessable.
  return `idem-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Decide the idempotency key for a submission attempt.
 *
 * - No previous attempt, or the intent changed since the last attempt:
 *   mint a new key — this is a genuinely new intent, not a retry.
 * - Same intent as the last attempt (a retry after a failed request):
 *   reuse the same key, so the backend can recognize it as the same
 *   logical request once it supports that.
 */
export function resolveIdempotencyKey(
  previous: IdempotencyState | null,
  intent: ProofIntent,
): IdempotencyState {
  const signature = intentSignature(intent);
  if (previous && previous.signature === signature) {
    return previous;
  }
  return { key: generateKey(), signature };
}
