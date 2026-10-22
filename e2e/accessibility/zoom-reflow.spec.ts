import { expect, test } from "@playwright/test";
import {
  DISPLAY_MODES,
  applyDisplayMode,
  describeFocusVisibility,
  findClippedControls,
  findOverlappingText,
  measureHorizontalOverflow,
  tabTo,
} from "./fixtures/display-modes";
import { mockEarnProofApi, mockVerifyApi } from "./fixtures/mock-api";
import { mockFreighterWallet } from "./fixtures/mock-freighter";

/**
 * Zoom, reflow, and large-text regression tests.
 *
 * The existing suites prove the app is accessible at a normal desktop and
 * mobile viewport. That is not the same as proving it works for someone who
 * zooms to 200%, reflows at 400%, enlarges their default font, or applies a
 * text-spacing override - all of which change how much content fits without
 * changing the window.
 *
 * Four criteria, one per WCAG success criterion:
 *   1.4.4  Resize text        -> nothing clipped at 200%
 *   1.4.10 Reflow             -> no two-dimensional scrolling at 320 CSS px
 *   1.4.12 Text Spacing       -> no obscured or overlapping content
 *   2.1.1  Keyboard           -> the core workflows still complete
 *
 * Every failure names the offending element, so a red run points at the fix
 * rather than starting an investigation.
 */

/**
 * Core routes: the two public workflows plus the pages a user passes through
 * to reach them. Deliberately not every route in `routes.ts` - this suite
 * runs four display modes per route in a real browser, and the value is in
 * covering the workflows deeply rather than the marketing pages broadly.
 */
const CORE_ROUTES = [
  { name: "home", path: "/" },
  { name: "faq", path: "/faq" },
  { name: "status", path: "/status" },
  { name: "verify", path: "/verify" },
  { name: "verify-credential", path: "/verify/credential" },
  { name: "proofs", path: "/proofs" },
];

async function visit(page: import("@playwright/test").Page, path: string) {
  await mockEarnProofApi(page);
  await mockVerifyApi(page);
  await mockFreighterWallet(page);
  const response = await page.goto(path);
  expect(response?.status(), `expected ${path} to load`).toBeLessThan(500);
  await page.waitForLoadState("networkidle");
}

for (const mode of DISPLAY_MODES) {
  test.describe(`${mode.name} (${mode.description})`, () => {
    for (const route of CORE_ROUTES) {
      test(`${route.name}: no control is clipped or collapsed`, async ({ page }) => {
        await visit(page, route.path);
        await applyDisplayMode(page, mode);

        const clipped = await findClippedControls(page);
        expect(
          clipped,
          `Controls unusable on ${route.path} at ${mode.name}:\n` +
            clipped.map((item) => `  ${item.selector} - ${item.reason}`).join("\n"),
        ).toEqual([]);
      });

      test(`${route.name}: content reflows without two-dimensional scrolling`, async ({
        page,
      }) => {
        await visit(page, route.path);
        await applyDisplayMode(page, mode);

        const overflow = await measureHorizontalOverflow(page);
        expect(
          overflow.offenders,
          `Content overflows horizontally on ${route.path} at ${mode.name} ` +
            `(scrollWidth ${overflow.documentScrollWidth} > clientWidth ${overflow.clientWidth}). ` +
            "A region that genuinely needs a two-dimensional layout must opt in with " +
            "data-allow-horizontal-scroll:\n" +
            overflow.offenders
              .map((item) => `  ${item.selector} right=${item.right} "${item.text}"`)
              .join("\n"),
        ).toEqual([]);

        expect(overflow.documentScrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
      });

      test(`${route.name}: no text obscures or overlaps other text`, async ({ page }) => {
        await visit(page, route.path);
        await applyDisplayMode(page, mode);

        const overlaps = await findOverlappingText(page);
        expect(
          overlaps,
          `Overlapping text on ${route.path} at ${mode.name}:\n` +
            overlaps.map((item) => `  ${item.a} overlaps ${item.b}`).join("\n"),
        ).toEqual([]);
      });

      test(`${route.name}: focus stays visible while tabbing`, async ({ page }) => {
        await visit(page, route.path);
        await applyDisplayMode(page, mode);
        await page.locator("body").click({ position: { x: 1, y: 1 } });

        const problems: string[] = [];
        for (let step = 0; step < 15; step += 1) {
          await page.keyboard.press("Tab");
          const focus = await describeFocusVisibility(page);
          if (focus.selector === "(none)") break;
          if (!focus.onScreen) problems.push(`${focus.selector} is focused but off screen`);
          if (focus.covered) problems.push(`${focus.selector} is focused but painted over`);
        }

        expect(problems, `Hidden focus on ${route.path} at ${mode.name}:\n${problems.join("\n")}`)
          .toEqual([]);
      });
    }
  });
}

/**
 * The two workflows that matter most: a worker creating a proof, and anyone
 * verifying one. Both must be completable with the keyboard alone in every
 * display mode - a layout that merely *renders* at 320 CSS px is no use if
 * the submit button cannot be reached.
 */
for (const mode of DISPLAY_MODES) {
  test.describe(`${mode.name}: workflows stay keyboard-completable`, () => {
    test("verification: proof id can be entered and submitted by keyboard", async ({ page }) => {
      await visit(page, "/verify");
      await applyDisplayMode(page, mode);

      // Addressed by id rather than by label text: the same words appear
      // again in the verification result panel once the lookup resolves.
      const proofInput = page.locator("#proof");
      await expect(proofInput).toBeVisible();

      await page.locator("body").click({ position: { x: 1, y: 1 } });
      expect(await tabTo(page, proofInput), "could not reach the proof id field by keyboard").toBe(
        true,
      );

      await page.keyboard.type("EP-8A42-91DC");
      const submit = page.getByRole("button", { name: "Verify proof" });
      expect(await tabTo(page, submit), "could not reach the submit button by keyboard").toBe(true);

      const focusBeforeSubmit = await describeFocusVisibility(page);
      expect(focusBeforeSubmit.onScreen).toBe(true);
      expect(focusBeforeSubmit.covered).toBe(false);

      await page.keyboard.press("Enter");
      // The verification result panel renders once the lookup resolves.
      await expect(page.locator("dl").first()).toBeVisible();
    });

    test("credential verification: an invalid credential still reports its error", async ({
      page,
    }) => {
      await visit(page, "/verify/credential");
      await applyDisplayMode(page, mode);

      const jsonInput = page.locator("#credential-json");
      await jsonInput.focus();
      await page.keyboard.type("not-json");

      const submit = page.getByRole("button", { name: "Validate credential" });
      expect(await tabTo(page, submit), "could not reach the submit button by keyboard").toBe(true);
      await page.keyboard.press("Enter");

      const alert = page.locator("#verify-credential-error");
      await expect(alert).toBeFocused();
      const focus = await describeFocusVisibility(page);
      expect(focus.onScreen, "the error alert took focus off screen").toBe(true);
    });

    test("proof creation: the wallet step is reachable and operable by keyboard", async ({
      page,
    }) => {
      await visit(page, "/proofs");
      await applyDisplayMode(page, mode);

      const connect = page.getByRole("button", { name: /connect freighter/i });
      await expect(connect).toBeVisible();

      await page.locator("body").click({ position: { x: 1, y: 1 } });
      expect(await tabTo(page, connect), "could not reach the wallet button by keyboard").toBe(
        true,
      );

      const focus = await describeFocusVisibility(page);
      expect(focus.onScreen, "the wallet button was focused off screen").toBe(true);
      expect(focus.covered, "the wallet button's focus ring was painted over").toBe(false);

      await page.keyboard.press("Enter");
      // Connecting unlocks the payments step; the layout must survive it.
      await expect(page.getByText(/Connected as/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Sync" })).toBeEnabled();
      expect(await findClippedControls(page)).toEqual([]);
    });
  });
}
