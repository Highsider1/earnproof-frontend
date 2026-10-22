import { expect, test } from "@playwright/test";
import {
  disableMotion,
  mockApi,
  mockFreighterNoAccess,
  seedSession,
} from "./utils/stabilize";
import {
  EMPTY_PAYMENTS,
  FIXTURE_PAYMENTS,
  FIXTURE_PROOF,
  FIXTURE_SESSION,
} from "./fixtures/payments";

/**
 * /proofs — the wallet-connect + income proof creation flow.
 *
 * Ownership: components/proofs/create-proof-flow.tsx. This is the only
 * "authenticated" surface that exists in the app today (there is no
 * dashboard route yet) — the "connected wallet" states below stand in for
 * the "authenticated" acceptance-criteria state by seeding a synthetic
 * session token into localStorage, never by driving a real wallet.
 */

test("proof-flow: disconnected initial state", async ({ page }) => {
  await page.goto("/proofs");
  await disableMotion(page);
  await expect(page).toHaveScreenshot("proof-flow-disconnected.png", {
    fullPage: true,
  });
});

test("proof-flow: wallet connecting (loading) state", async ({ page }) => {
  // No extension is installed in this browser context. requestAccess()
  // then genuinely never resolves (see utils/stabilize.ts), so this is the
  // app's real, unmodified behavior — not a simulated wait.
  await page.goto("/proofs");
  await disableMotion(page);
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(
    page.getByText("Requesting Freighter wallet access..."),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("proof-flow-wallet-loading.png", {
    fullPage: true,
  });
});

test("proof-flow: wallet error state", async ({ page }) => {
  await mockFreighterNoAccess(page);
  await page.goto("/proofs");
  await disableMotion(page);
  await page.getByRole("button", { name: "Connect Freighter" }).click();
  await expect(
    page.getByText("Freighter was not found or did not return a Stellar address."),
  ).toBeVisible();
  await expect(page).toHaveScreenshot("proof-flow-wallet-error.png", {
    fullPage: true,
  });
});

test("proof-flow: connected, empty payments state", async ({ page }) => {
  await seedSession(page, FIXTURE_SESSION);
  await mockApi(page, "/payments", EMPTY_PAYMENTS);
  await page.goto("/proofs");
  await disableMotion(page);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("No payments loaded yet.")).toBeVisible();
  await expect(page).toHaveScreenshot("proof-flow-connected-empty.png", {
    fullPage: true,
  });
});

test("proof-flow: connected, with payments state", async ({ page }) => {
  await seedSession(page, FIXTURE_SESSION);
  await mockApi(page, "/payments", FIXTURE_PAYMENTS);
  await page.goto("/proofs");
  await disableMotion(page);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("USDC incoming payment").first()).toBeVisible();
  await expect(page).toHaveScreenshot("proof-flow-connected-payments.png", {
    fullPage: true,
  });
});

test("proof-flow: proof created (success) state", async ({ page }) => {
  await seedSession(page, FIXTURE_SESSION);
  await mockApi(page, "/payments", FIXTURE_PAYMENTS);
  await mockApi(page, "/proofs/minimum-income", FIXTURE_PROOF);
  await page.goto("/proofs");
  await disableMotion(page);
  await page.getByRole("button", { name: "Refresh" }).click();
  await expect(page.getByText("USDC incoming payment").first()).toBeVisible();
  await page.getByLabel("Select payment").first().check();
  await page.getByRole("button", { name: "Create proof" }).click();
  await expect(page.getByText("Proof created.")).toBeVisible();
  await expect(page).toHaveScreenshot("proof-flow-success.png", {
    fullPage: true,
  });
});
