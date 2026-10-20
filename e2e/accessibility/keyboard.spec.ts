import { expect, test } from "@playwright/test";
import { mockEarnProofApi } from "./fixtures/mock-api";
import { mockFreighterWallet } from "./fixtures/mock-freighter";

/**
 * Real keyboard-driven interaction tests (not axe). Covers: skip link,
 * disclosures (FAQ accordion), form error focus/association, and focus
 * restoration after a dismiss interaction.
 *
 * Two criteria from the issue have no current subject in this app and are
 * documented rather than faked:
 *  - Nav menu: components/layout/public-nav.tsx has no dropdown/mobile
 *    menu disclosure yet (nav links are simply hidden below the `md`
 *    breakpoint). See docs/accessibility-testing.md.
 *  - Dialogs/modals: none exist in the app yet. The harness (this file +
 *    fixtures/) is ready for a keyboard-trap/focus-return test the moment
 *    one is added.
 */

test.describe("skip link", () => {
  test("tab reveals the skip link and activating it moves focus to main content", async ({
    page,
  }) => {
    await page.goto("/");

    await page.keyboard.press("Tab");
    const skipLink = page.getByRole("link", { name: "Skip to main content" });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press("Enter");
    const main = page.locator("#main-content");
    await expect(main).toBeFocused();
  });
});

test.describe("mobile navigation", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("supports keyboard opening, trapped tab order, Escape, and focus restoration", async ({
    page,
  }) => {
    await page.goto("/");

    const trigger = page.getByRole("button", { name: "Toggle main navigation" });
    await trigger.focus();
    await page.keyboard.press("Enter");

    const close = page.getByRole("button", { name: "Close main navigation" });
    await expect(close).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "true");

    await page.keyboard.press("Shift+Tab");
    await expect(page.getByRole("link", { name: "Settings" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});

test.describe("FAQ accordion disclosure", () => {
  test("Enter toggles a question open and focus stays on the trigger", async ({ page }) => {
    await page.goto("/faq");

    const firstQuestionButton = page.locator('[id^="question-"]').first();
    await firstQuestionButton.focus();
    await expect(firstQuestionButton).toHaveAttribute("aria-expanded", "false");

    await page.keyboard.press("Enter");
    await expect(firstQuestionButton).toHaveAttribute("aria-expanded", "true");
    await expect(firstQuestionButton).toBeFocused();

    const answerId = await firstQuestionButton.getAttribute("aria-controls");
    await expect(page.locator(`#${answerId}`)).toBeVisible();

    await page.keyboard.press("Space");
    await expect(firstQuestionButton).toHaveAttribute("aria-expanded", "false");
  });

  test("clearing the search restores focus to the search field", async ({ page }) => {
    await page.goto("/faq");

    const searchInput = page.getByLabel("Search frequently asked questions");
    await searchInput.fill("stellar");
    const clearButton = page.getByRole("button", { name: "Clear" });
    await clearButton.click();

    await expect(searchInput).toBeFocused();
  });
});

test.describe("form error announcements", () => {
  test("verify: submitting blank input moves focus to an associated alert", async ({ page }) => {
    await page.goto("/verify");

    const submit = page.getByRole("button", { name: "Verify proof" });
    await submit.click();

    const alert = page.locator("#verify-proof-error");
    await expect(alert).toBeFocused();
    await expect(submit).toHaveAttribute("aria-describedby", "verify-proof-error");
  });

  test("verify credential: invalid JSON moves focus to an associated alert", async ({ page }) => {
    await page.goto("/verify/credential");

    await page.getByLabel("Credential JSON", { exact: true }).fill("not json");
    const submit = page.getByRole("button", { name: "Validate credential" });
    await submit.click();

    const alert = page.locator("#verify-credential-error");
    await expect(alert).toBeFocused();
    await expect(submit).toHaveAttribute("aria-describedby", "verify-credential-error");
  });

  test("proofs: proof-creation failure moves focus to an associated alert", async ({
    page,
  }) => {
    await mockEarnProofApi(page, { failProofCreation: true });
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    await expect(page.getByText(/Connected as/)).toBeVisible();
    await page.getByRole("button", { name: "Sync" }).click();
    await expect(page.getByText(/USDC incoming payment/)).toBeVisible();
    await page.getByLabel("Select payment").check();

    const submit = page.getByRole("button", { name: "Create proof" });
    await submit.click();

    const alert = page.locator("#create-proof-error");
    await expect(alert).toBeFocused();
  });
});

test.describe("focus restoration", () => {
  test("disconnecting the wallet restores focus to Connect Freighter", async ({ page }) => {
    await mockEarnProofApi(page);
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    const disconnect = page.getByRole("button", { name: "Disconnect" });
    await expect(disconnect).toBeVisible();

    await disconnect.click();
    await expect(page.getByRole("button", { name: "Connect Freighter" })).toBeFocused();
  });
});
