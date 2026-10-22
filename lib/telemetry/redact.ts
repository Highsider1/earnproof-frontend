/**
 * Redaction for client error telemetry.
 *
 * A browser error message is the single most likely place for user data to
 * escape: it routinely embeds the value that caused the failure. In this app
 * that value can be a Stellar address, a pasted verifiable credential, a
 * proof ID, a bearer token, or an API URL with a query string.
 *
 * `redactMessage` therefore does not try to decide whether a message is
 * safe. It rewrites every recognizable *shape* of sensitive data into a
 * placeholder token, drops anything URL-like wholesale, and caps the result.
 * What survives is enough to tell two different failures apart ("Failed to
 * fetch", "Unexpected token < in JSON") and nothing more.
 */

/** Hard cap on the redacted message. Long enough to distinguish failures. */
export const MAX_MESSAGE_SHAPE_LENGTH = 160;

/**
 * Ordered redaction rules.
 *
 * Order matters twice over: broad structural shapes (key material, JSON
 * payloads, URLs) are consumed before the narrower value shapes, and the
 * narrow shapes run before the generic long-token rules so a Stellar address
 * is not partially eaten by them.
 *
 * Placeholders are angle-bracketed (`<address>`) rather than
 * square-bracketed on purpose: a later rule must never be able to match a
 * placeholder an earlier rule produced, and `[...]` is exactly what the
 * JSON-payload rule looks for.
 */
const REDACTION_RULES: ReadonlyArray<{ pattern: RegExp; token: string }> = [
  // PEM blocks and other key material — everything from the header on is
  // dropped, since nothing after it is worth keeping.
  { pattern: /-----BEGIN[\s\S]*/g, token: "<key-material>" },
  // Anything JSON-shaped: a serialized credential, proof body or payment
  // record. Requires a quote after the opening brace so ordinary prose
  // containing a bracket is not swallowed. The match is greedy so a nested
  // payload is consumed whole rather than leaving a stray brace behind.
  { pattern: /[{[]\s*["'][\s\S]*[}\]]/g, token: "<object>" },
  // Any URL, with or without a query string. Query strings are how proof
  // IDs travel, so URLs are never partially preserved.
  { pattern: /\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, token: "<url>" },
  // Stellar public keys (G...), muxed accounts (M...), secret seeds (S...)
  // and contract ids (C...): base32, 56 characters.
  { pattern: /\b[GMSC][A-Z2-7]{55}\b/g, token: "<address>" },
  // JWTs and other dot-delimited base64url triples (bearer tokens).
  { pattern: /\b[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, token: "<token>" },
  // Email addresses.
  { pattern: /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/g, token: "<email>" },
  // Proof identifiers as rendered in this app (EP-8A42-91DC).
  { pattern: /\bEP-[A-Z0-9]{2,}(?:-[A-Z0-9]{2,})+\b/gi, token: "<proof-id>" },
  // Hex blobs: transaction hashes, signatures, ledger keys.
  { pattern: /\b(?:0x)?[0-9a-f]{16,}\b/gi, token: "<hex>" },
  // Base64-ish blobs: encoded credentials, proof bodies, QR payloads.
  { pattern: /\b[A-Za-z0-9+/=_-]{32,}\b/g, token: "<blob>" },
  // Bare digit runs long enough to be an account number, a card number, or
  // an amount in stroops. Short numbers (status codes, indices) are left
  // alone because they carry real diagnostic value.
  { pattern: /\b\d{7,}\b/g, token: "<number>" },
];

/**
 * Reduce an error message to a redacted, length-capped shape.
 *
 * Non-string input (an object thrown instead of an Error, `undefined`)
 * collapses to an empty shape rather than being coerced and inspected —
 * coercing an unknown object is exactly how a credential ends up in a log.
 */
export function redactMessage(message: unknown): string {
  if (typeof message !== "string" || message.length === 0) {
    return "";
  }

  let redacted = message;
  for (const rule of REDACTION_RULES) {
    redacted = redacted.replace(rule.pattern, rule.token);
  }

  redacted = redacted.replace(/\s+/g, " ").trim();

  return redacted.length > MAX_MESSAGE_SHAPE_LENGTH
    ? redacted.slice(0, MAX_MESSAGE_SHAPE_LENGTH - 1) + "…"
    : redacted;
}

/**
 * Truncate an event timestamp to the minute.
 *
 * A millisecond-precise timestamp is a strong correlation handle: joined
 * against any other log it can single out one user's session. Minute
 * precision is more than enough to place an error on an incident timeline.
 */
export function toEventTimestamp(now: number | Date = Date.now()): string {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now);
  date.setUTCSeconds(0, 0);
  return date.toISOString();
}
