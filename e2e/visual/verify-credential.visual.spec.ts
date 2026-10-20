import { expect, test } from "@playwright/test";
import { disableMotion, mockApi, mockApiFailure } from "./utils/stabilize";
import { FIXTURE_VERIFY_VALID } from "./fixtures/payments";

/**
 * /verify/credential — public credential-upload verification.
 *
 * Ownership: components/verification/verify-credential-form.tsx and
 * components/verification/verification-panel.tsx (shared with
 * verify.visual.spec.ts).
 */

test("verify-credential: empty initial state", async ({ page }) => {
  await page.goto("/verify/credential");
  await disableMotion(page);
  await expect(page).toHaveScreenshot("verify-credential-empty.png", {
    fullPage: true,
  });
});

test("verify-credential: success state", async ({ page }) => {
  await mockApi(page, "/proofs/*/verify", FIXTURE_VERIFY_VALID);
  await page.goto("/verify/credential");
  await disableMotion(page);
  await page
    .getByLabel("Credential JSON", { exact: true })
    .fill('{"id":"EP-FIXT-0001"}');
  await page.getByRole("button", { name: "Validate credential" }).click();
  await expect(page.getByText(/^valid$/i)).toBeVisible();
  await expect(page).toHaveScreenshot("verify-credential-success.png", {
    fullPage: true,
  });
});

test("verify-credential: error state", async ({ page }) => {
  await mockApiFailure(page, "/proofs/*/verify");
  await page.goto("/verify/credential");
  await disableMotion(page);
  await page
    .getByLabel("Credential JSON", { exact: true })
    .fill('{"id":"EP-FIXT-0001"}');
  await page.getByRole("button", { name: "Validate credential" }).click();
  await expect(
    page.getByText("Verification request failed. Check the credential and API URL."),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("verify-credential-error.png", {
    fullPage: true,
  });
});
