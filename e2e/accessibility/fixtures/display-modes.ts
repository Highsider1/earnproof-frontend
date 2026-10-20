import type { Locator, Page } from "@playwright/test";

/**
 * Display modes for the zoom / reflow / large-text regression suite, and the
 * DOM probes that decide whether the interface survives them.
 *
 * A viewport-only responsive check proves a layout works at a *narrow window*.
 * It does not prove the interface works for someone who zooms, enlarges text,
 * or applies a text-spacing override — those change the relationship between
 * CSS pixels and content, not just the width of the window.
 *
 * How each mode is produced, and why:
 *
 * - **200% zoom** (WCAG 1.4.4 Resize text). Browser zoom halves the CSS
 *   viewport: a 1280x800 window at 200% presents 640x400 CSS px. Playwright
 *   cannot drive the browser's own zoom control, so the mode is reproduced by
 *   setting the CSS viewport to what zoom would produce, which is exactly the
 *   condition the layout has to survive.
 * - **400% reflow** (WCAG 1.4.10 Reflow). The standard is written as
 *   1280x1024 at 400%, i.e. a 320x256 CSS px viewport, and requires no
 *   scrolling in two dimensions.
 * - **Text spacing** (WCAG 1.4.12 Text Spacing). The exact overrides named
 *   in the success criterion, injected as a stylesheet.
 * - **Large text**. Root font size doubled, which is what a user who raises
 *   their browser's default font size gets - and unlike zoom, it grows the
 *   text without growing the boxes around it.
 */

export type DisplayMode = {
  name: string;
  description: string;
  viewport: { width: number; height: number };
  /** CSS injected after navigation, if the mode needs it. */
  styleSheet?: string;
};

/** WCAG 1.4.12 Text Spacing: the exact values the success criterion names. */
const TEXT_SPACING_CSS = `
  *, *::before, *::after {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p, li, dd, dt, h1, h2, h3, h4, h5, h6 {
    margin-bottom: 2em !important;
  }
`;

const LARGE_TEXT_CSS = `
  html { font-size: 200% !important; }
`;

export const DISPLAY_MODES: DisplayMode[] = [
  {
    name: "zoom-200",
    description: "200% browser zoom on a 1280x800 window (640x400 CSS px)",
    viewport: { width: 640, height: 400 },
  },
  {
    name: "reflow-320",
    description: "400% zoom on a 1280x1024 window (320x256 CSS px)",
    viewport: { width: 320, height: 256 },
  },
  {
    name: "text-spacing",
    description: "WCAG 1.4.12 text spacing overrides at a 1280x800 window",
    viewport: { width: 1280, height: 800 },
    styleSheet: TEXT_SPACING_CSS,
  },
  {
    name: "large-text",
    description: "Doubled root font size at a 1280x800 window",
    viewport: { width: 1280, height: 800 },
    styleSheet: LARGE_TEXT_CSS,
  },
];

/**
 * Put the page into a display mode and wait for layout to settle.
 *
 * The override stylesheet is installed through the CSSOM
 * (`adoptedStyleSheets`) rather than `page.addStyleTag`. The app sends a
 * strict `style-src 'self' 'nonce-...'` policy, which correctly blocks an
 * injected inline `<style>` element - and that policy is worth keeping, so
 * the test adapts instead. A constructed stylesheet is not inline content
 * and is unaffected.
 */
export async function applyDisplayMode(page: Page, mode: DisplayMode): Promise<void> {
  await page.setViewportSize(mode.viewport);
  if (mode.styleSheet) {
    await page.evaluate((css) => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }, mode.styleSheet);
  }
  // One frame is enough for the browser to lay out again; waiting on a
  // network state here would be both slower and unrelated.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

/**
 * Regions allowed to scroll horizontally. WCAG 1.4.10 exempts "content
 * requiring two-dimensional layout for usage or meaning" - for this app that
 * is the wide status/FAQ data tables. A region opts in explicitly by
 * carrying `data-allow-horizontal-scroll`, so the exemption is a reviewable
 * marker in the markup rather than a silent pass in the test.
 */
export const HORIZONTAL_SCROLL_OPT_IN = "data-allow-horizontal-scroll";

export type OverflowReport = {
  documentScrollWidth: number;
  clientWidth: number;
  offenders: Array<{ selector: string; right: number; text: string }>;
};

/**
 * Does the page require scrolling in two dimensions, and if so, which
 * elements stick out past the viewport?
 *
 * Reporting the offending elements (not just "the page is too wide") is the
 * difference between a failure that names the fix and one that starts an
 * investigation.
 */
export async function measureHorizontalOverflow(page: Page): Promise<OverflowReport> {
  return page.evaluate((optIn) => {
    const root = document.documentElement;
    const clientWidth = root.clientWidth;

    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : "";
      const cls = (element.getAttribute("class") ?? "").split(/\s+/).filter(Boolean).slice(0, 3);
      return `${tag}${id}${cls.length ? "." + cls.join(".") : ""}`;
    };

    // `checkVisibility` accounts for ancestors, which a per-element
    // `display` check does not: this app hides its desktop nav links with a
    // `hidden md:flex` wrapper, so the links themselves still report
    // `display: block` while not being rendered at all.
    const isRendered = (element: Element): boolean =>
      typeof (element as HTMLElement).checkVisibility === "function"
        ? (element as HTMLElement).checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: false,
            visibilityProperty: true,
          })
        : true;

    const offenders: Array<{ selector: string; right: number; text: string }> = [];
    for (const element of Array.from(document.body.querySelectorAll("*"))) {
      if (element.closest(`[${optIn}]`)) continue;
      if (!isRendered(element)) continue;

      const box = element.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      // A 1px tolerance absorbs sub-pixel rounding in the layout engine.
      if (box.right > clientWidth + 1) {
        offenders.push({
          selector: describe(element),
          right: Math.round(box.right),
          text: (element.textContent ?? "").trim().slice(0, 40),
        });
      }
    }

    return {
      documentScrollWidth: root.scrollWidth,
      clientWidth,
      offenders: offenders.slice(0, 10),
    };
  }, HORIZONTAL_SCROLL_OPT_IN);
}

export type ClippedControl = { selector: string; reason: string };

/**
 * Interactive controls that are unusable in the current mode: cut off by the
 * viewport, collapsed to nothing, or clipped by an ancestor that hides its
 * overflow.
 */
export async function findClippedControls(page: Page): Promise<ClippedControl[]> {
  return page.evaluate(() => {
    const selector =
      'a[href], button:not([disabled]), input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])';

    const describe = (element: Element): string => {
      const tag = element.tagName.toLowerCase();
      const id = element.id ? `#${element.id}` : "";
      const label =
        element.getAttribute("aria-label") ?? (element.textContent ?? "").trim().slice(0, 30);
      return `${tag}${id} "${label}"`;
    };

    const isRendered = (element: Element): boolean =>
      typeof (element as HTMLElement).checkVisibility === "function"
        ? (element as HTMLElement).checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: false,
            visibilityProperty: true,
          })
        : true;

    const clipped: ClippedControl[] = [];
    for (const element of Array.from(document.querySelectorAll(selector))) {
      // Not rendered at all (a `hidden md:flex` wrapper, a closed
      // disclosure) is a different thing from rendered-but-clipped, and
      // only the latter is this check's subject.
      if (!isRendered(element)) continue;
      // Visually-hidden-but-focusable patterns (skip links, sr-only file
      // inputs) are intentionally offscreen until focused.
      if (element.classList.contains("sr-only")) continue;

      const box = element.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) {
        clipped.push({ selector: describe(element), reason: "collapsed to zero size" });
        continue;
      }
      if (box.right > document.documentElement.clientWidth + 1) {
        clipped.push({ selector: describe(element), reason: "extends past the viewport" });
        continue;
      }

      // An ancestor that hides overflow and is smaller than this control
      // cuts it off with no way to scroll to the rest.
      let parent = element.parentElement;
      while (parent && parent !== document.body) {
        const parentStyle = getComputedStyle(parent);
        if (parentStyle.overflow === "hidden" || parentStyle.overflowY === "hidden") {
          const parentBox = parent.getBoundingClientRect();
          if (box.bottom > parentBox.bottom + 1 || box.right > parentBox.right + 1) {
            clipped.push({
              selector: describe(element),
              reason: `clipped by ancestor ${parent.tagName.toLowerCase()} with hidden overflow`,
            });
            break;
          }
        }
        parent = parent.parentElement;
      }
    }
    return clipped.slice(0, 10);
  });
}

export type OverlapReport = { a: string; b: string };

/**
 * Text that overlaps other text. This is what a text-spacing or large-text
 * override breaks first, and unlike clipping it is invisible to an axe scan:
 * the content is present in the accessibility tree while being unreadable on
 * screen.
 *
 * Only leaf text elements are compared, and only against elements that are
 * not their own ancestors or descendants, so ordinary nesting is not
 * reported as an overlap.
 */
export async function findOverlappingText(page: Page): Promise<OverlapReport[]> {
  return page.evaluate(() => {
    const describe = (element: Element): string =>
      `${element.tagName.toLowerCase()} "${(element.textContent ?? "").trim().slice(0, 30)}"`;

    const leaves = Array.from(
      document.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, dt, dd, label, span, button, a"),
    ).filter((element) => {
      const html = element as HTMLElement;
      if (typeof html.checkVisibility === "function" && !html.checkVisibility({
        contentVisibilityAuto: true,
        opacityProperty: false,
        visibilityProperty: true,
      })) {
        return false;
      }
      const style = getComputedStyle(element);
      if (style.position === "absolute" || style.position === "fixed") return false;
      if ((element.textContent ?? "").trim().length === 0) return false;
      // Leaf-ish only: an element whose text lives in child elements would
      // trivially "overlap" those children.
      return !element.querySelector("p, h1, h2, h3, h4, h5, h6, li, dt, dd, label, span");
    });

    const boxes = leaves.map((element) => ({ element, box: element.getBoundingClientRect() }));
    const overlaps: OverlapReport[] = [];

    for (let i = 0; i < boxes.length && overlaps.length < 10; i += 1) {
      for (let j = i + 1; j < boxes.length && overlaps.length < 10; j += 1) {
        const first = boxes[i];
        const second = boxes[j];
        if (first.element.contains(second.element) || second.element.contains(first.element)) {
          continue;
        }
        // Require a meaningful intersection: a few pixels of shared edge is
        // normal for inline boxes and is not an overlap a reader would see.
        const overlapX =
          Math.min(first.box.right, second.box.right) - Math.max(first.box.left, second.box.left);
        const overlapY =
          Math.min(first.box.bottom, second.box.bottom) - Math.max(first.box.top, second.box.top);
        if (overlapX > 4 && overlapY > 4) {
          overlaps.push({ a: describe(first.element), b: describe(second.element) });
        }
      }
    }
    return overlaps;
  });
}

/**
 * Is the currently focused element actually visible to a sighted keyboard
 * user - on screen, non-zero, and not painted over by a sticky header?
 */
export async function describeFocusVisibility(page: Page): Promise<{
  selector: string;
  onScreen: boolean;
  covered: boolean;
}> {
  return page.evaluate(() => {
    const active = document.activeElement;
    if (!active || active === document.body) {
      return { selector: "(none)", onScreen: false, covered: false };
    }

    const describe = `${active.tagName.toLowerCase()} "${(active.textContent ?? "").trim().slice(0, 30)}"`;

    // Deliberately visually-hidden-but-focusable controls (the skip link
    // before activation, the sr-only file input behind its visible proxy
    // button) are an intended pattern, not a regression.
    if (active.classList.contains("sr-only")) {
      return { selector: describe, onScreen: true, covered: false };
    }

    const box = active.getBoundingClientRect();
    const root = document.documentElement;
    const onScreen =
      box.width > 0 &&
      box.height > 0 &&
      box.bottom > 0 &&
      box.right > 0 &&
      box.top < root.clientHeight &&
      box.left < root.clientWidth;

    // Hit-test several points across the control rather than only its
    // centre, and treat the control as reachable if it appears anywhere in
    // the stack at any of them. A label or wrapper painted over part of its
    // own control is normal; being absent from every stack is what actually
    // means the focus ring is behind something else.
    const clamp = (value: number, max: number) => Math.min(Math.max(value, 1), max - 1);
    const points: Array<[number, number]> = [
      [box.left + box.width / 2, box.top + box.height / 2],
      [box.left + 2, box.top + 2],
      [box.right - 2, box.top + 2],
      [box.left + 2, box.bottom - 2],
      [box.right - 2, box.bottom - 2],
    ];

    const reachable = points.some(([x, y]) => {
      const stack = document.elementsFromPoint(
        clamp(x, root.clientWidth),
        clamp(y, root.clientHeight),
      );
      return stack.some((element) => element === active || active.contains(element));
    });

    return { selector: describe, onScreen, covered: onScreen && !reachable };
  });
}

/** Tab until `target` holds focus, or give up after `limit` presses. */
export async function tabTo(page: Page, target: Locator, limit = 40): Promise<boolean> {
  for (let i = 0; i < limit; i += 1) {
    await page.keyboard.press("Tab");
    if (await target.evaluate((node) => node === document.activeElement)) {
      return true;
    }
  }
  return false;
}
