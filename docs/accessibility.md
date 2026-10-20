# Zoom, reflow, and large-text accessibility

`docs/accessibility-testing.md` covers the axe and keyboard suites. This
document covers the display-mode regression checks added for issue #81:
what they test, how each mode is produced, and how to fix a failure.

A viewport-only responsive check proves a layout works in a *narrow window*.
It does not prove the interface works for someone who zooms, enlarges their
default font, or applies a text-spacing override — those change how much
content fits without changing the window.

## The four modes

| Mode | Produced by | Success criterion |
| --- | --- | --- |
| `zoom-200` | 640x400 CSS px viewport (a 1280x800 window at 200% zoom) | WCAG 1.4.4 Resize text |
| `reflow-320` | 320x256 CSS px viewport (1280x1024 at 400%) | WCAG 1.4.10 Reflow |
| `text-spacing` | line-height 1.5, letter-spacing 0.12em, word-spacing 0.16em, paragraph spacing 2em | WCAG 1.4.12 Text Spacing |
| `large-text` | root font size 200% | Enlarged default font |

Playwright cannot drive the browser's own zoom control, so the zoom modes are
reproduced by setting the CSS viewport to what that zoom level would present.
That is exactly the condition the layout has to survive.

The text-spacing and large-text overrides are installed through the CSSOM
(`document.adoptedStyleSheets`) rather than `page.addStyleTag`. The app sends
a strict nonce-based style element policy that correctly blocks an injected
inline `<style>`, and that policy is worth keeping — so the test adapts
instead.

## What each check asserts

Run against `/`, `/faq`, `/status`, `/verify`, `/verify/credential` and
`/proofs`, in every mode:

- **No control is clipped or collapsed.** Every focusable control has a
  non-zero box, sits inside the viewport, and is not cut off by an ancestor
  that hides its overflow. Elements that are not rendered at all (a `hidden
  md:flex` wrapper, a closed disclosure) are skipped — not-rendered is a
  different thing from rendered-but-clipped. `sr-only` controls are skipped
  too: being visually hidden until focused is the intended pattern.
- **Content reflows without two-dimensional scrolling.** No element extends
  past the viewport width, and `scrollWidth` does not exceed `clientWidth`.
- **No text obscures or overlaps other text.** Leaf text elements are
  compared pairwise; a shared edge of more than 4px in both axes is an
  overlap. This is the failure mode a text-spacing override produces first,
  and it is invisible to an axe scan — the content is still in the
  accessibility tree while being unreadable on screen.
- **Focus stays visible while tabbing.** Fifteen tab stops per route; the
  focused control must be on screen and must appear in the hit-test stack at
  one of five sampled points, so a wrapper painted over part of its own
  control is not reported while a control genuinely behind something else is.

And in every mode, the two core workflows must complete by keyboard alone:
entering and submitting a proof ID, submitting an invalid credential and
reaching its error alert, and connecting a wallet on the proof-creation
route.

### Approved two-dimensional regions

WCAG 1.4.10 exempts "content requiring two-dimensional layout for usage or
meaning". A region claims that exemption by carrying
`data-allow-horizontal-scroll`:

```tsx
<div className="overflow-x-auto" data-allow-horizontal-scroll>
  {/* a genuinely wide data table */}
</div>
```

The marker is deliberately explicit markup rather than a list inside the
test, so granting an exemption is a reviewable change in the component.

Nothing in the app claims it today.

## Running them

```bash
npm run test:e2e:a11y         # the whole accessibility suite
npm run test:e2e:a11y:zoom    # just the zoom / reflow / large-text specs
npm run test:e2e:a11y:report  # open the last HTML report
```

They run under `playwright.a11y.config.ts`, which builds and starts a
production server, runs one worker at a time so focus- and layout-sensitive
assertions are deterministic, and points the app at the mocked API origin the
fixtures intercept.

## Fixing a failure

Every failure names the offending element. The two most common causes, both
found by these checks when they were first run:

**An opaque identifier forcing a minimum width.** `break-words`
(`overflow-wrap`) lets a long word wrap but does **not** reduce the element's
min-content width, so a 56-character wallet address or transaction hash still
forces the whole page hundreds of pixels wide. Use `break-all`
(`word-break`), which does reduce it. Correct for opaque identifiers; do not
use it on prose.

**A control keeping its intrinsic width.** A grid or flex item defaults to
`min-width: auto`, so a `date` input (wide by default) pushes past a narrow
viewport. `min-w-0` on the item and `w-full` on the control fixes it.

## Known gap: navigation below `md`

`components/layout/public-nav.tsx` has no mobile menu — the nav links are
simply hidden below the `md` breakpoint. At 200% zoom on a desktop, and at
400% reflow, the primary navigation is therefore absent with nothing to
replace it.

These tests do **not** fail on it, because a control that is not rendered is
outside what a clipping check can meaningfully assert, and adding a
navigation menu is a product change rather than a regression fix. It is
recorded here, and in `docs/accessibility-testing.md`, as the outstanding
work.

## Resolved issue: CSP nonce and hydration

Nonce-based CSP requires request-time rendering so the fresh nonce generated
by `proxy.ts` can also be applied to the Next.js runtime scripts in the
HTML response. `app/layout.tsx` therefore opts the app shell into dynamic
rendering, and `proxy.ts` forwards the CSP on the request headers that
Next's renderer reads for nonce extraction.

The accessibility suite now runs with CSP enforcement enabled, so future
nonce regressions surface as real browser failures instead of being hidden by
the test configuration.
