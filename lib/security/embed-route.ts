/**
 * The ONLY route family allowed to opt into `frame-ancestors *` (see
 * `allowEmbedding` on `buildSecurityPolicy` in `config/security-headers.ts`).
 * Deliberately a prefix match on a single, dedicated top-level segment —
 * not a pattern that could accidentally widen to match an unrelated route
 * later (e.g. this does not match `/embedded-something` or
 * `/settings/embed`).
 *
 * Kept in its own module (no `next/server` import) so it can be unit
 * tested directly — `next/server`'s `NextRequest`/`NextResponse` need
 * edge-runtime globals (`Request`, etc.) that this project's jsdom-based
 * jest environment does not provide, and importing them merely to reach a
 * pure routing predicate would make that predicate untestable under the
 * existing jest setup. See `proxy.ts` for the actual middleware that uses
 * this, and `tests/security/embed-route.test.ts` for the tests.
 */

const EMBED_ROUTE_PREFIX = "/embed/";

export function isEmbedRoute(pathname: string): boolean {
  return pathname === "/embed" || pathname.startsWith(EMBED_ROUTE_PREFIX);
}
