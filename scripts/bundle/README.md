# Bundle composition and duplicate dependency budgets

This directory implements the client bundle composition gate for issue #82.

A route can sit comfortably inside a total-size budget while quietly:

- picking up a **second copy of a library** at a different version,
- pulling in a **package nobody approved** for the browser, or
- dragging **server-only code** (Node builtins, non-public environment
  variables, secret material) across the server/client boundary.

`scripts/performance/` answers "is this route too big?". This gate answers
"what is actually *in* it, and who owns each byte?".

## What runs, and when

| Command | What it does |
| --- | --- |
| `npm run bundle:analyze` | Runs a production build with `ANALYZE_BUNDLE=1`, then analyzes it. This is what CI runs. |
| `npm run bundle:check` | Analyzes the build already in `.next` (use after your own analysis build). |
| `npm run bundle:baseline` | Rebuilds and rewrites `baseline.json`. Run this whenever you change `budgets.json`. |

CI runs `npm run bundle:analyze` in the `frontend` job after `npm run build`
and uploads `.next/analyze/bundle-report.json` as a build artifact.

## How attribution works

Minified Turbopack chunks contain no module paths, so the only accurate way
to say which package owns which bytes is to read the client source maps.
`next.config.ts` therefore sets:

```ts
productionBrowserSourceMaps: process.env.ANALYZE_BUNDLE === "1"
```

**A normal `next build` still emits no browser source maps.** They are opted
into only for an analysis build, because shipping them would publish the
app's original sources to anyone who opens devtools. That is the one
deliberate trade-off in this change, and it is why the analyzer runs its own
build rather than reusing the deploy build.

From there:

1. Every route's client JS is read with the same route/asset helper used by
   `scripts/performance/budget-check.js`: prerendered HTML when it exists,
   and Next.js client-reference manifests for dynamic app routes. That keeps
   the two gates aligned even when nonce-based CSP requires request-time
   rendering instead of static HTML.
2. Each chunk is matched to its source map through the chunk's own
   `sourceMappingURL` comment (Turbopack hashes map filenames independently
   of the chunk, so the `<chunk>.js.map` sibling convention does not hold).
3. Each source in the map is attributed to an owner: an npm package name, a
   first-party top-level directory (`app`, `components`, `lib`, `config`),
   the bundler runtime, or — if none of those match — `unknown`, which is a
   **failure**, not a silent bucket.
4. A chunk's real on-disk bytes are split across its owners in proportion to
   how much original source each contributed. That is an estimate (minified
   output cannot be attributed exactly), but a deterministic one: identical
   sources always produce identical numbers.

Two things are attributed by name rather than by source map, both because
they have no usable map data:

- **`next (polyfills)`** — Next's legacy-browser polyfill chunk ships without
  a source map. It is identified from `build-manifest.json#polyfillFiles`.
- **`ownerAliases`** — a dependency that ships its own pre-bundled source map
  (`@stellar/freighter-api` emits `webpack://freighterApi/...`) is mapped to
  its npm name by an explicit prefix entry in `budgets.json`. Because such a
  package carries no `node_modules` path, its version is read from the
  hoisted install, so it can only ever contribute one instance to the
  duplicate check.

## What fails the build

| Category | Rule |
| --- | --- |
| `route-budget` | A route's first-load client JS exceeds `routes[route].clientJsBytes` (or `defaults`). The failure names the largest owner. |
| `duplicate-dependency` | Any package resolves to more than one version across client chunks. |
| `unexpected-client-package` | A package reached a client chunk without being listed in `allowedClientPackages`. |
| `server-only-leak` | A Node builtin, a package in `serverOnlyPackages`, a path matching `serverOnlyPathPatterns`, a non-`NEXT_PUBLIC_` `process.env` read from first-party code, or a `secretPatterns` match. |
| `unattributed-module` | A module could not be attributed to any owner. |
| `governance` | See below. |

Notes on the server-only rule:

- The `process.env` scan is scoped to **first-party** modules
  (`serverOnlyPolicy.envScanKinds`). Framework internals legitimately read
  build-time flags Next inlines (`__NEXT_*`, `NEXT_RUNTIME`); those are the
  bundler's compile-time switches, not this app's server/client boundary.
- When `secretPatterns` matches, the report records **the matching rule, not
  the matched text** — echoing a suspected secret into a CI log would be the
  very leak the check exists to prevent.

Baseline drift is *reported*, not failed: any route whose client JS moves by
more than `significantChange` (5 KB or 2%, whichever comes first) is printed
and recorded under `significantChanges` in the JSON report. The hard gates
are the table above.

## Changing a budget

Budgets are only meaningful if raising one is a reviewed act. Two mechanical
rules enforce that:

1. **Every route budget carries a `reason` and an ISO `reviewedOn` date.** A
   budget entry without them fails the check, so the diff that raises a
   number also states why.
2. **`baseline.json` records a `budgetsHash`** — a SHA-256 of the canonical
   (recursively key-sorted) `budgets.json`. Any edit to `budgets.json`
   invalidates it.

So the process is:

```bash
# 1. edit scripts/bundle/budgets.json — update the number, the reason and reviewedOn
# 2. regenerate the reviewed baseline
npm run bundle:baseline
# 3. commit budgets.json and baseline.json together, and explain the change in the PR
```

Skipping step 2 fails CI with `stale-baseline`, so a budget change can never
land without the reviewed baseline change that goes with it, and a reviewer
always sees both the new limit and its real measured composition in the same
diff.

## Stable, machine-readable output

`.next/analyze/bundle-report.json` contains, for every route, the client JS
byte total, the chunk count and the owner→bytes breakdown, plus the resolved
client package list, duplicates, unexpected packages, server-only leaks,
baseline drift and the pass/fail verdict.

It carries no timestamps, no content hashes and no absolute paths, and every
collection is sorted, so two analysis builds of the same source produce
byte-identical JSON. That is what makes it safe to diff between runs and to
attach to a PR.

## Tests

`bundle-analysis.test.js` runs under the normal `npm test` (jest) run and
drives every rule directly, including the failure path for each one — a
budget gate that has never been proven to fail is not a gate. It also
asserts that the **committed** `budgets.json` and `baseline.json` are in
sync, so a stale baseline is caught by the unit suite as well as by CI.
