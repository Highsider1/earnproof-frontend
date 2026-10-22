/**
 * Route-scoping tests for the embeddable verification widget's CSP
 * carve-out (issue #196). `proxy.ts` is the actual per-request enforcement
 * point (see the comment in `next.config.ts` explaining why the static
 * config `headers()` deliberately does NOT duplicate this) — these tests
 * cover the routing decision that feeds `buildSecurityPolicy({
 * allowEmbedding })`.
 *
 * `NextRequest`/`proxy.ts` need edge-runtime globals (`Request`, etc.) that
 * this project's jsdom-based jest environment does not provide (see
 * `jest.setup.ts` — only the polyfills existing code needs are there), so
 * this suite exercises `isEmbedRoute` (`lib/security/embed-route.ts`)
 * directly rather than constructing a real `NextRequest`/calling `proxy()`
 * end to end — that module deliberately has no `next/server` import so it
 * can be tested this way. `tests/security/headers.test.ts` separately
 * covers exactly what `buildSecurityPolicy({ allowEmbedding: true })`
 * changes (and does not change) once that flag is set.
 */

import { isEmbedRoute } from "@/lib/security/embed-route";

describe("isEmbedRoute (issue #196 CSP carve-out routing)", () => {
  it("matches the embed widget route and its subpaths", () => {
    expect(isEmbedRoute("/embed/v1/verify/EP-8A42-91DC")).toBe(true);
    expect(isEmbedRoute("/embed/v1/verify/anything")).toBe(true);
    expect(isEmbedRoute("/embed/v2/verify/anything")).toBe(true); // future version
    expect(isEmbedRoute("/embed/")).toBe(true);
    expect(isEmbedRoute("/embed")).toBe(true);
  });

  it("does not match unrelated routes, including ones that merely start with the same letters", () => {
    expect(isEmbedRoute("/")).toBe(false);
    expect(isEmbedRoute("/verify/EP-8A42-91DC")).toBe(false);
    expect(isEmbedRoute("/settings/activity")).toBe(false);
    expect(isEmbedRoute("/settings")).toBe(false);
    expect(isEmbedRoute("/proofs")).toBe(false);
    // Must not accidentally widen to paths that merely share a prefix.
    expect(isEmbedRoute("/embedded-something")).toBe(false);
    expect(isEmbedRoute("/settings/embed")).toBe(false);
    expect(isEmbedRoute("/embedx")).toBe(false);
  });

  it("does not match a lookalike path that only differs by case or trailing content tricks", () => {
    // frame-ancestors scoping must be exact-prefix, not case-insensitive or
    // fooled by encoded/duplicated slashes — pathname here is whatever
    // Next.js has already normalized, so this just guards the literal
    // string comparison itself from silently becoming case-insensitive.
    expect(isEmbedRoute("/Embed/v1/verify/x")).toBe(false);
    expect(isEmbedRoute("/EMBED/v1/verify/x")).toBe(false);
  });
});
