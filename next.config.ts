import type { NextConfig } from "next";
import { buildSecurityPolicy, nextHeaderList } from "./config/security-headers";
import { cacheHeaderRules } from "./config/cache-headers";

const securityPolicy = buildSecurityPolicy();
// Static fallback/mirror of the embeddable verification widget's CSP
// carve-out (issue #196). `proxy.ts` is what actually enforces this
// per-request (it also attaches the per-request nonce), but empirically
// (`next start` + inspecting real response headers for both a normal
// route and /embed/v1/verify/...) Next.js 16 layers `next.config.ts`'s
// static `headers()` output back onto the response in addition to
// whatever middleware set, keyed per header — so a header middleware sets
// is replaced, but a header middleware stays silent on (or even
// explicitly `.delete()`s) is NOT removed if a matching config rule still
// sets it. That means the global "/:path*" rule below, if left matching
// /embed/* too, would always re-add a stale `X-Frame-Options: DENY` to
// embed responses even though proxy.ts asks for it to be absent —
// contradicting `frame-ancestors *` instead of honoring it. The fix is
// for the GLOBAL rule's `source` to simply not match /embed/* at all
// (via the same negative-lookahead style already used by proxy.ts's own
// matcher), and for a second, non-overlapping rule to supply the embed
// policy — so there is no header-key overlap between the two rules to
// reason about.
const embedSecurityPolicy = buildSecurityPolicy({ allowEmbedding: true });
const publicEnv = securityPolicy.env;
const nextPublicEnv: Record<string, string> = {
  NEXT_PUBLIC_APP_URL: publicEnv.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_API_URL: publicEnv.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_STELLAR_NETWORK: publicEnv.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
    publicEnv.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE,
  NEXT_PUBLIC_STELLAR_HORIZON_URL: publicEnv.NEXT_PUBLIC_STELLAR_HORIZON_URL,
};

if (publicEnv.NEXT_PUBLIC_HELP_URL) {
  nextPublicEnv.NEXT_PUBLIC_HELP_URL = publicEnv.NEXT_PUBLIC_HELP_URL;
}

if (publicEnv.NEXT_PUBLIC_STELLAR_EXPLORER_URL) {
  nextPublicEnv.NEXT_PUBLIC_STELLAR_EXPLORER_URL =
    publicEnv.NEXT_PUBLIC_STELLAR_EXPLORER_URL;
}

if (publicEnv.NEXT_PUBLIC_WEB_VITALS_ENDPOINT) {
  nextPublicEnv.NEXT_PUBLIC_WEB_VITALS_ENDPOINT =
    publicEnv.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;
}

/**
 * Client source maps are the only reliable way to attribute a minified
 * Turbopack chunk back to the packages and files that produced it, which is
 * what the bundle composition gate (`scripts/bundle/`) needs.
 *
 * They are emitted **only** when the analyzer explicitly asks for them
 * (`ANALYZE_BUNDLE=1`), never in a normal `next build`: shipping browser
 * source maps to production would publish the app's original sources, and
 * that is a deliberate trade-off this flag keeps opt-in and local to the
 * analysis run.
 */
const analyzeBundle = process.env.ANALYZE_BUNDLE === "1";

const nextConfig: NextConfig = {
  env: nextPublicEnv,
  productionBrowserSourceMaps: analyzeBundle,
  // @noble/ed25519 (deployment-metadata signature verification, #185) ships
  // pure ESM with no CJS build. Both the Next.js build and next/jest's
  // generated Jest config otherwise leave all of node_modules untransformed,
  // which breaks importing it; transpilePackages is the supported way to
  // carve out just this package for both.
  transpilePackages: ["@noble/ed25519"],
  async headers() {
    return [
      {
        // Everything EXCEPT /embed/* gets the strict, unmodified policy —
        // see the long comment above `embedSecurityPolicy` for why this
        // must be a non-overlapping `source` rather than a second rule
        // relying on "last rule wins" for a shared path.
        source: "/((?!embed/).*)",
        headers: nextHeaderList(securityPolicy).map((header) => ({
          key: header.key,
          value: header.value,
        })),
      },
      {
        // The ONE narrowly-scoped exception (issue #196): allows framing
        // for the embeddable public verification widget only. Every other
        // directive/header is identical to the strict policy — see
        // `config/security-headers.ts`'s `allowEmbedding` option and
        // tests/security/headers.test.ts.
        source: "/embed/:path*",
        headers: nextHeaderList(embedSecurityPolicy).map((header) => ({
          key: header.key,
          value: header.value,
        })),
      },
      // See docs/cache-policy.md for the per-route Cache-Control rationale.
      ...cacheHeaderRules().map(({ source, headers }) => ({ source, headers })),
    ];
  },
};

export default nextConfig;
