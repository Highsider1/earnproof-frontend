# Route performance budgets

This directory implements the performance budget gate for issue #57: per-route
JavaScript and asset budgets, checked in CI against every `next build`.

## What is measured, and how

`check-budgets.js` requires a completed production build (`next build`). For
every navigable app route (from `.next/app-path-routes-manifest.json`, minus
route handlers and Next-internal routes) it:

1. Reads the prerendered HTML Next.js emits at
   `.next/server/app/<route>.html` when a route has static HTML. Dynamic
   app routes have no route HTML at build time, so the script falls back to
   that route's Next.js client-reference manifest and page build manifest to
   collect the same `/_next/static/...` script and stylesheet assets the
   browser needs on first load.
2. Resolves each referenced asset to a file under `.next/static` and reads
   its real size on disk.
3. Sums the JS assets into **First Load JS** for that route, and finds the
   **largest single asset** (JS or CSS) for that route.
4. Compares both numbers against `budgets.json`, per route (falling back to
   `defaults` for any route without an explicit entry).
5. On any regression, prints which route and which specific chunk is
   responsible, and the exact overage, then exits non-zero.

The comparison logic (`evaluateBudgets` in `budget-check.js`) is a pure
function over plain data — it never touches the filesystem — which is what
lets `budget-check.test.js` unit test it directly, including a **negative
fixture** that sets an artificially low budget and asserts the check reports
failure with route + chunk context. That test is the proof the gate can
actually fail; see "Why a unit test instead of a full regression build"
below.

## Test conditions (documented, per acceptance criteria)

- **Build**: `next build` in production mode (Turbopack), no dev-server
  overhead. Sizes are read from the build output only, using prerendered HTML for static routes and client-reference manifests for dynamic routes.
- **Node/npm**: Node `>=20.11.1` (`.nvmrc`), npm `>=10.0.0`, matching
  `package.json#engines`.
- **JS / largest-asset budgets**: enforced in CI on every PR and push, via
  `node scripts/performance/check-budgets.js` after `next build`.
- **LCP / CLS / interaction latency**: `budgets.json` documents target
  values (`lcpMs`, `cls`, `interactionLatencyMs`) per route, under a
  `Slow 4G` network profile (1.6 Mbps down / 750 Kbps up / 150ms RTT) and a
  4x CPU slowdown (Lighthouse's mobile preset) — the conditions to use for
  a manual/periodic Lighthouse audit against a `next build && next start`
  server. These are **not** machine-gated in CI in this change (see
  trade-off below); they are corroborated in production by the real-user
  Web Vitals diagnostics reporter (`components/common/web-vitals-reporter.tsx`,
  `lib/diagnostics/`), which reports actual LCP/CLS/INP from real page loads.

## Why a unit test instead of a full build regression

The acceptance criteria call for proof the gate can fail. Two ways to get
that:

1. Temporarily bloat the real app so a real `next build` exceeds budget, or
2. Unit test the comparison function with a synthetic measurement and an
   artificially low budget.

This repo uses (2), in `budget-check.test.js`. It is deterministic, runs in
milliseconds under `npm test`, doesn't require mutating the app to prove a
negative, and tests the exact same `evaluateBudgets` function the CLI uses
against real build output — so there's no gap between what's tested and
what runs in CI. A full-build regression test would additionally exercise
`measureRoute`'s build-output parsing path, which is covered separately by the
`extractStaticAssetPaths`, `extractRouteAssetPaths`, and `routeToHtmlFile`
unit tests using small HTML and client-manifest fixtures - so both halves
(parsing real build output, and the budget comparison) are tested without
needing a second, slower, real-build-based test run.

## Why LCP/CLS/interaction latency aren't machine-gated in CI (yet)

Measuring real LCP/CLS/INP requires a running server and an actual browser
(Lighthouse or Playwright), which means starting `next start`, launching a
browser, and holding CI open for a full page render — meaningfully heavier
and flakier (network/CPU variance) than a build-output size check. This repo
has no such fixture yet (no Playwright/Lighthouse-CI dependency, no existing
browser-driven e2e suite to extend). Given the choice the issue explicitly
allows — "pick the simpler, real, working approach and document why" — this
change ships the deterministic, fast, CI-friendly gate (JS + largest-asset
budgets, which are a strong predictive proxy for hydration cost and LCP
weight) now, and ships **real** field measurement for LCP/CLS/INP via the
Web Vitals reporter, rather than a synthetic Lighthouse run that would add a
browser dependency to CI without a server-lifecycle fixture to run it
against. Wiring a Playwright + Lighthouse (or `playwright` + `web-vitals`
in-page measurement) job against `next build && next start` is the natural
follow-up once this repo has an e2e fixture; the documented network/CPU
profile above is exactly what that job should use.

## Wallet code isolation (`@stellar/freighter-api`)

`/verify`, `/verify/credential`, and every other public/landing route never
reference the `@stellar/freighter-api` chunk - confirmed by inspecting the
static assets Next.js assigns to each route after `next build`. Only the `/proofs` creation surfaces load it, and even there
it is loaded lazily via a dynamic `import("@stellar/freighter-api")` inside
the wallet
connect handler in `components/proofs/create-proof-flow.tsx`, not as part of
those routes' first load JS — it only downloads once a worker clicks
"Connect Freighter". See the PR description for the exact chunk-level
evidence from a real build.

## Updating budgets

Bump the relevant number in `budgets.json` in the same PR as the change that
needs it, with a one-line reason (see the existing `note` field on
`/proofs` for the expected format). Don't bump a budget to silence a
regression without understanding what grew.
