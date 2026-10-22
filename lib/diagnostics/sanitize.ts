/**
 * Privacy-safe normalization for Web Vitals / diagnostics reporting.
 *
 * These helpers strip anything that could identify a person, a wallet, or a
 * specific credential/proof before a metric is logged or sent anywhere:
 *
 * - Query strings are dropped entirely. `/verify?proof=EP-8A42-91DC` and
 *   similar URLs are how proof IDs travel through this app, and query
 *   strings are unbounded/high-cardinality by nature, so the safest rule is
 *   "never forward them", not "try to allow-list the safe ones".
 * - The path itself is matched against a fixed list of known route
 *   patterns. Anything that doesn't match a known static route collapses to
 *   "/other" rather than being reported verbatim — this guards against
 *   future dynamic segments (e.g. a `/verify/[proofId]` route) leaking a
 *   proof ID or wallet address through the path.
 */

// Keep in sync with the routes under `app/`. Only public, static (non
// dynamic-segment) routes belong here — this list is the allow-list.
export const KNOWN_ROUTE_PATTERNS = [
  "/",
  "/developers",
  "/faq",
  "/how-it-works",
  "/issuers",
  "/privacy",
  "/proofs",
  "/status",
  "/terms",
  "/verify",
  "/verify/credential",
  "/verify/scan",
] as const;

export type KnownRoutePattern = (typeof KNOWN_ROUTE_PATTERNS)[number];

const KNOWN_ROUTE_SET = new Set<string>(KNOWN_ROUTE_PATTERNS);

/**
 * Reduce a raw pathname (no query string) to a known, low-cardinality route
 * pattern. Unrecognized paths — including anything carrying an id-like
 * segment — fall back to "/other" so they never appear verbatim in
 * diagnostics.
 */
export function toRoutePattern(pathname: string): KnownRoutePattern | "/other" {
  const normalized = normalizePathname(pathname);
  return KNOWN_ROUTE_SET.has(normalized)
    ? (normalized as KnownRoutePattern)
    : "/other";
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?")[0]?.split("#")[0] ?? "";
  if (withoutQuery.length > 1 && withoutQuery.endsWith("/")) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery || "/";
}
