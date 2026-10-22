/**
 * The client error telemetry contract.
 *
 * Operational diagnostics are only useful if they preserve user privacy and
 * stay stable enough to correlate an incident across reports. This module is
 * the single definition of what a client error event may contain — the
 * allow-list, the stable category vocabulary, and nothing else.
 *
 * The rule this contract is built on: **fields are allow-listed, never
 * denied.** A deny-list has to anticipate every future leak; an allow-list
 * only has to be reviewed when someone wants to add a field. Everything a
 * browser error naturally carries — the message, the stack, the URL, the
 * DOM — is therefore absent unless it appears below.
 *
 * Deliberately excluded, and why:
 *
 * - **Wallet addresses / credentials / proof bodies / payment data** — never
 *   collected at any layer. `lib/telemetry/redact.ts` additionally scrubs
 *   them out of anything derived from an error message, so a leak needs two
 *   independent mistakes rather than one.
 * - **Full URLs and query strings** — `/verify?proof=EP-8A42-91DC` is how
 *   proof IDs travel through this app. Only a low-cardinality route pattern
 *   from `lib/diagnostics/sanitize.ts` is reported.
 * - **Raw error messages and stacks** — messages routinely embed the value
 *   that caused the failure (a pasted credential, a proof ID, an API URL).
 *   Only a redacted, length-capped *shape* of the message is sent.
 * - **User, session, or wallet identifiers of any kind** — see
 *   `lib/telemetry/correlation.ts` for what the correlation id is and, more
 *   importantly, what it is not.
 */

/**
 * Every field a serialized client error event may contain. `serializeEvent`
 * projects onto exactly these keys, so an extra property added anywhere
 * upstream is dropped rather than transmitted.
 */
export const ALLOWED_EVENT_FIELDS = [
  "schemaVersion",
  "category",
  "severity",
  "route",
  "occurredAt",
  "correlationId",
  "pageLoadId",
  "errorName",
  "messageShape",
  "release",
  "sampleRate",
] as const;

export type AllowedEventField = (typeof ALLOWED_EVENT_FIELDS)[number];

/** Bumped only when the shape below changes in a way a consumer must handle. */
export const SCHEMA_VERSION = 1;

/**
 * Stable error categories. These are the vocabulary an on-call responder
 * groups and alerts on, so they are intentionally coarse, product-shaped and
 * append-only: renaming one breaks historical correlation, which is the
 * whole point of having them.
 */
export const ERROR_CATEGORIES = [
  "api.network-unavailable",
  "api.timeout",
  "api.cancelled",
  "api.client-error",
  "api.server-error",
  "api.rate-limited",
  "api.contract-mismatch",
  "input.validation-rejected",
  "wallet.unavailable",
  "wallet.rejected",
  "render.component-error",
  "runtime.unhandled-rejection",
  "runtime.uncaught-error",
  "unknown",
] as const;

export type ErrorCategory = (typeof ERROR_CATEGORIES)[number];

const CATEGORY_SET = new Set<string>(ERROR_CATEGORIES);

export function isErrorCategory(value: unknown): value is ErrorCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export type ErrorSeverity = "warning" | "error";

/**
 * Error constructor names safe to report verbatim. These are standard
 * platform names with no user content in them; anything else collapses to
 * `"Error"` so a custom error class cannot smuggle a value out through its
 * own name.
 */
export const ALLOWED_ERROR_NAMES = [
  "AbortError",
  "DOMException",
  "Error",
  "EvalError",
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "QuotaExceededError",
  "RangeError",
  "ReferenceError",
  "SecurityError",
  "SyntaxError",
  "TimeoutError",
  "TypeError",
  "URIError",
] as const;

const ERROR_NAME_SET = new Set<string>(ALLOWED_ERROR_NAMES);

export function toAllowedErrorName(name: unknown): string {
  return typeof name === "string" && ERROR_NAME_SET.has(name) ? name : "Error";
}

/**
 * A fully-built, already-redacted client error event. Nothing upstream of
 * `buildClientErrorEvent` is present on it.
 */
export type ClientErrorEvent = {
  schemaVersion: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  /** Low-cardinality route pattern; never a full URL or query string. */
  route: string;
  /** ISO-8601, truncated to the minute — see `lib/telemetry/redact.ts`. */
  occurredAt: string;
  /** Opaque, random, per-event. Not an identity or an authenticator. */
  correlationId: string;
  /** Opaque, random, per-page-load. Groups the events of one incident. */
  pageLoadId: string;
  errorName: string;
  /** Redacted, length-capped shape of the error message. */
  messageShape: string;
  release: string;
  /** The rate this event was sampled at, so volume can be reconstructed. */
  sampleRate: number;
};

/**
 * Project an event onto the allow-list. Anything not named in
 * `ALLOWED_EVENT_FIELDS` is dropped here, which is the last line of defence
 * before serialization: a caller that attaches `walletAddress` to an event
 * object cannot transmit it.
 */
export function serializeEvent(event: Record<string, unknown>): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const field of ALLOWED_EVENT_FIELDS) {
    if (event[field] !== undefined) {
      serialized[field] = event[field];
    }
  }
  return serialized;
}
