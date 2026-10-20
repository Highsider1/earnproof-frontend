# Visual regression suite

This directory holds a dedicated Playwright suite that screenshots
representative EarnProof routes and states, and fails a pull request when
the rendered output drifts from the committed baseline images.

It is deliberately separate from any other Playwright suite the project
may add (functional e2e, accessibility, performance): a different
`playwright.config.ts`, its own npm script (`test:e2e:visual`), and its
own CI job (`visual-regression` in `.github/workflows/ci.yml`), so this
suite can be reviewed, run, and evolved on its own.

## Running it locally

```bash
npm run build        # production build — the suite serves the build output
npm run test:e2e:visual
```

The first run requires Playwright's Chromium browser:

```bash
npx playwright install --with-deps chromium
```

## Viewports

Configured in `playwright.config.ts` as three projects. Every spec runs
against all three, so every baseline exists three times (once per
viewport).

| Project        | Size (w x h) | Why |
| --------------- | ------------ | --- |
| `desktop-1440`  | 1440 x 900   | The app's max content width (`pageContainer` caps at 1440px) — this is the desktop layout that has been reviewed/approved. |
| `tablet-768`    | 768 x 1024   | The intermediate width required by the issue. 768px is also the Tailwind `md` breakpoint the app already branches layout on (feature grids collapse to a single column, the nav switches to the compact header, `DataPanel` drops its table header row), so it's the width most likely to expose an in-between regression a desktop/mobile pair would miss. |
| `mobile-390`    | 390 x 844    | The approved mobile breakpoint (an iPhone 12/13/14-class viewport) — the narrowest width the layouts are designed for. |

## What is covered, and who owns a diff

| Spec | Route(s) | Component(s) under test | Suggested owner |
| --- | --- | --- | --- |
| `public-pages.visual.spec.ts` | `/`, `/how-it-works`, `/developers`, `/issuers`, `/faq`, `/privacy`, `/terms`, `/status` | `components/layout/public-shell.tsx`, `public-nav.tsx`, `public-footer.tsx`, `components/common/production-ui.tsx` (`MarketingHero`, `FeatureGrid`, `MetricGrid`, `DataPanel`, `StatusBadge`), `components/common/page-heading.tsx` | Whoever owns the shared shell/marketing components — a diff on more than one of these routes at once almost always means a shared component changed, not the page itself. |
| `verify.visual.spec.ts` | `/verify` | `components/verification/verify-proof-form.tsx`, `verification-panel.tsx` | Verification-surface owner. |
| `verify-credential.visual.spec.ts` | `/verify/credential` | `components/verification/verify-credential-form.tsx`, `verification-panel.tsx` (shared with the spec above) | Verification-surface owner; cross-check `verify.visual.spec.ts` since both consume `VerificationPanel`. |
| `proof-flow.visual.spec.ts` | `/proofs` | `components/proofs/create-proof-flow.tsx` | Proof-creation flow owner. |

Each spec file also carries this table as a comment block at the top, so
it stays next to the code it documents.

### States covered

Per the issue's acceptance criteria (public / authenticated / loading /
empty / error / success):

- **Public**: every route in `public-pages.visual.spec.ts`, plus the
  disconnected/default state of `/verify`, `/verify/credential`, and
  `/proofs`.
- **Authenticated**: the app has no dashboard or login route yet — the
  only "authenticated" surface today is the wallet-connected state inside
  `/proofs`. Those states are reached by seeding a synthetic
  session token into `localStorage` (see `seedSession` in
  `utils/stabilize.ts`), never by driving a real wallet extension. This is
  called out explicitly as the closest real analog, not a fabricated
  dashboard.
- **Loading**: `verify: loading state` (delayed, mocked API response,
  captured mid-request) and `proof-flow: wallet connecting (loading)
  state` (a stalled `window.freighter` shim that never resolves).
- **Empty**: `verify: not-found (empty result) state` and `proof-flow:
  connected, empty payments state`.
- **Error**: `verify: error state`, `verify-credential: error state`, and
  `proof-flow: wallet error state` (the real "Freighter not found" path —
  no extension is installed in CI, so this is a genuine, not simulated,
  error state).
- **Success**: `verify: success state`, `verify-credential: success
  state`, and `proof-flow: proof created (success) state`.

## Determinism / stabilization

Real backends are never called. Anything that would otherwise be
non-deterministic is fixed before a screenshot is taken:

- **Animations/transitions**: `expect.toHaveScreenshot` runs with
  `animations: "disabled"` (finishes CSS animations/transitions
  instantly) and every test also calls `disableMotion(page)`
  (`utils/stabilize.ts`), which injects a stylesheet forcing
  `animation-duration`/`transition-duration` to `0ms` and disabling smooth
  scrolling, so a mid-transition frame can never be captured.
- **Timestamps / IDs**: every dynamic value (proof IDs, payment IDs,
  transaction hashes, wallet addresses, issued/expiry dates) comes from
  fixed literals in `fixtures/payments.ts`, injected via
  `page.route()` interception (`mockApi`/`mockApiFailure` in
  `utils/stabilize.ts`). Nothing reads `Date.now()`, `crypto.randomUUID`,
  or similar at render time in the covered states. Locale/timezone are
  pinned (`locale: "en-US"`, `timezoneId: "UTC"`) so `formatDate` output
  is stable regardless of the machine running the suite.
- **External resources**: the app self-hosts its fonts via
  `next/font/google` (bundled at build time, no runtime request to
  fonts.googleapis.com), and the suite runs against `next build && next
  start`, so there are no third-party network dependencies to mock.
- **Wallet extension**: `/proofs` normally depends on a real
  Freighter browser extension. The suite never installs one — it either
  lets the real "not found" failure occur (a genuine error state, see
  above) or injects a `window.freighter` shim that intentionally never
  resolves, to hold a loading state open for the screenshot
  (`installStalledFreighter`).

None of this hides a real layout defect: every mock only replaces *what
data is shown*, never *how* it's rendered — the components render exactly
the markup/classes they would with a real API response.

## Sensitive data

All fixture data in `fixtures/payments.ts` is fabricated: wallet
addresses, transaction hashes, and proof/credential IDs are placeholder
strings, not real Stellar values. No real credentials, wallet material,
or user data are used anywhere in this suite or committed to the
repository. CI diff artifacts (`e2e/visual/.report`,
`e2e/visual/.test-results`) only ever contain renders of this synthetic
data.

## Thresholds

`playwright.config.ts` sets a conservative
`expect.toHaveScreenshot.maxDiffPixelRatio` of `0.01` (1% of pixels) for
every test. This is deliberately strict — it should catch spacing,
overflow, and typography regressions, while still tolerating trivial
anti-aliasing noise between runs. Tightening or loosening this value is a
one-line, reviewable change in the config, not scattered across specs.

## Updating baselines

Baseline images are checked in under `*-snapshots/` next to each spec.
**A baseline image change is a visual-review action, not routine test
maintenance.**

- Never run `test:e2e:visual:update` (`--update-snapshots`) and commit the
  result as part of an unrelated change.
- If a PR intentionally changes a covered layout, regenerate baselines
  with `npm run test:e2e:visual:update`, review the resulting diffs
  yourself (compare old vs. new PNGs), and say so explicitly in the pull
  request description — e.g. a `## Visual baseline update` section naming
  which snapshots changed and why. A baseline-only diff with no such note
  should be treated as a red flag in review, not approved silently.
- Baselines must be generated by the same environment CI runs in (Linux,
  the versions pinned in `package-lock.json`/`playwright.config.ts`) —
  baselines generated on macOS/Windows will not match `ubuntu-latest` and
  will cause CI to fail even with no real change, since font rendering
  differs by platform. Generate them via the `visual-regression` CI job
  (or an equivalent Linux environment), not a local non-Linux machine.
