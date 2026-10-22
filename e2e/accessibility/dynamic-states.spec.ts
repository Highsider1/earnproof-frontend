import { expect, test } from "@playwright/test";
import { runAxeScan } from "./fixtures/axe";
import { mockEarnProofApi, mockVerifyApi } from "./fixtures/mock-api";
import { mockFreighterWallet } from "./fixtures/mock-freighter";

/**
 * Scans dynamic loading / success / error states reachable through the
 * proof-creation and verification flows, not just their initial HTML.
 * Wallet + API calls are mocked (see fixtures/) so these states are
 * reproducible without a live backend or a real Freighter extension.
 */
test.describe("proofs dynamic states", () => {
  test("wallet connected + payments loaded (success state)", async ({ page }, testInfo) => {
    await mockEarnProofApi(page);
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    await expect(page.getByText(/Connected as/)).toBeVisible();

    await page.getByRole("button", { name: "Sync" }).click();
    await expect(page.getByText(/USDC incoming payment/)).toBeVisible();

    await runAxeScan(page, testInfo, { routeName: "proofs-create-connected" });
  });

  test("proof creation loading state", async ({ page }, testInfo) => {
    await mockEarnProofApi(page, { delayMs: 800 });
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    await expect(page.getByText(/Connected as/)).toBeVisible();
    await page.getByRole("button", { name: "Sync" }).click();
    await expect(page.getByText(/USDC incoming payment/)).toBeVisible();

    await page.getByLabel("Select payment").check();
    await page.getByRole("button", { name: "Create proof" }).click();

    await expect(page.getByText("Creating signed minimum-income proof...")).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "proofs-create-loading" });
  });

  test("proof creation error state", async ({ page }, testInfo) => {
    await mockEarnProofApi(page, { failProofCreation: true });
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    await expect(page.getByText(/Connected as/)).toBeVisible();
    await page.getByRole("button", { name: "Sync" }).click();
    await expect(page.getByText(/USDC incoming payment/)).toBeVisible();

    await page.getByLabel("Select payment").check();
    await page.getByRole("button", { name: "Create proof" }).click();

    await expect(page.locator("#create-proof-error")).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "proofs-create-error" });
  });

  test("proof creation success state", async ({ page }, testInfo) => {
    await mockEarnProofApi(page);
    await mockFreighterWallet(page);

    await page.goto("/proofs");
    await page.getByRole("button", { name: "Connect Freighter" }).click();
    await expect(page.getByText(/Connected as/)).toBeVisible();
    await page.getByRole("button", { name: "Sync" }).click();
    await expect(page.getByText(/USDC incoming payment/)).toBeVisible();

    await page.getByLabel("Select payment").check();
    await page.getByRole("button", { name: "Create proof" }).click();

    await expect(page.getByText(/Proof ID:/)).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "proofs-create-success" });
  });

  test("initial state (no wallet connected yet)", async ({ page }, testInfo) => {
    await mockEarnProofApi(page);

    await page.goto("/proofs");
    // The submit button is disabled until a wallet is connected and a
    // qualifying payment is selected. Assert that disabled affordance
    // itself renders accessibly (accessible name, disabled state exposed).
    const submit = page.getByRole("button", { name: "Create proof" });
    await expect(submit).toBeDisabled();

    await runAxeScan(page, testInfo, { routeName: "proofs-create-initial-disabled" });
  });
});

test.describe("verify dynamic states", () => {
  test("verify proof loading state", async ({ page }, testInfo) => {
    await mockVerifyApi(page, { delayMs: 800 });

    await page.goto("/verify");
    await page.getByLabel("Proof ID").fill("EP-8A42-91DC");
    await page.getByRole("button", { name: "Verify proof" }).click();

    await expect(page.getByRole("button", { name: "Checking..." })).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "verify-loading" });
  });

  test("verify proof success state", async ({ page }, testInfo) => {
    await mockVerifyApi(page, { status: "valid" });

    await page.goto("/verify");
    await page.getByLabel("Proof ID").fill("EP-8A42-91DC");
    await page.getByRole("button", { name: "Verify proof" }).click();

    await expect(page.getByText("valid")).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "verify-success" });
  });

  test("verify proof empty-input error state", async ({ page }, testInfo) => {
    await mockVerifyApi(page);

    await page.goto("/verify");
    await page.getByRole("button", { name: "Verify proof" }).click();

    await expect(page.locator("#verify-proof-error")).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "verify-error" });
  });

  test("verify credential invalid-json error state", async ({ page }, testInfo) => {
    await mockVerifyApi(page);

    await page.goto("/verify/credential");
    await page.getByLabel("Credential JSON", { exact: true }).fill("not valid json");
    await page.getByRole("button", { name: "Validate credential" }).click();

    await expect(page.locator("#verify-credential-error")).toBeVisible();
    await runAxeScan(page, testInfo, { routeName: "verify-credential-error" });
  });
});
