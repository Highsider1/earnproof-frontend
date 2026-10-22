import { expect, test } from "@playwright/test";
import { disableMotion, mockApi, mockApiFailure } from "./utils/stabilize";
import {
  FIXTURE_VERIFY_UNKNOWN,
  FIXTURE_VERIFY_VALID,
} from "./fixtures/payments";

/**
 * /verify — public proof-ID verification.
 *
 * Ownership: components/verification/verify-proof-form.tsx and
 * components/verification/verification-panel.tsx (shared with
 * verify-credential.visual.spec.ts). Owned by whoever maintains the
 * verification surface — a diff here should also be checked against
 * verify-credential.visual.spec.ts since both consume VerificationPanel.
 *
 * All backend responses are intercepted with synthetic fixtures (see
 * fixtures/payments.ts) — no real proof IDs, wallets, or credentials.
 */

test("verify: empty initial state", async ({ page }) => {
  await page.goto("/verify");
  await disableMotion(page);
  await expect(page).toHaveScreenshot("verify-empty.png", { fullPage: true });
});

test("verify: loading state", async ({ page }) => {
  await mockApi(page, "/proofs/*/verify", FIXTURE_VERIFY_VALID, {
    delayMs: 5000,
  });
  await page.goto("/verify");
  await disableMotion(page);
  await page.getByLabel("Proof ID").fill("EP-FIXT-0001");
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(page.getByRole("button", { name: "Checking..." })).toBeVisible();
  await expect(page).toHaveScreenshot("verify-loading.png", { fullPage: true });
});

test("verify: success state", async ({ page }) => {
  await mockApi(page, "/proofs/*/verify", FIXTURE_VERIFY_VALID);
  await page.goto("/verify");
  await disableMotion(page);
  await page.getByLabel("Proof ID").fill("EP-FIXT-0001");
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(page.getByText(/^valid$/i)).toBeVisible();
  await expect(page).toHaveScreenshot("verify-success.png", { fullPage: true });
});

test("verify: not-found (empty result) state", async ({ page }) => {
  await mockApi(page, "/proofs/*/verify", FIXTURE_VERIFY_UNKNOWN);
  await page.goto("/verify");
  await disableMotion(page);
  await page.getByLabel("Proof ID").fill("EP-DOES-NOT-EXIST");
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(page.getByText(/No matching EarnProof credential/)).toBeVisible();
  await expect(page).toHaveScreenshot("verify-not-found.png", { fullPage: true });
});

test("verify: error state", async ({ page }) => {
  await mockApiFailure(page, "/proofs/*/verify");
  await page.goto("/verify");
  await disableMotion(page);
  await page.getByLabel("Proof ID").fill("EP-FIXT-0001");
  await page.getByRole("button", { name: "Verify proof" }).click();
  await expect(page.getByText("Verification request failed. Check the proof ID and API URL.")).toBeVisible();
  await expect(page).toHaveScreenshot("verify-error.png", { fullPage: true });
});
