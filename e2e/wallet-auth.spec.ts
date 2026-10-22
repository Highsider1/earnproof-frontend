import { test, expect } from "./fixtures/test";
import { ProofCreationPage } from "./fixtures/pages";
import { SYNTHETIC_SESSION_TOKEN, SYNTHETIC_WORKER_ADDRESS } from "./fixtures/synthetic-data";

test.describe("wallet connect and authenticate", () => {
  test("connects Freighter, completes the challenge/verify handshake, and persists the session", async ({
    page,
    apiMock,
    freighter,
  }) => {
    await freighter();
    const proofPage = new ProofCreationPage(page);
    await proofPage.goto();

    await expect(proofPage.connectButton).toBeVisible();
    await proofPage.connectButton.click();

    await expect(proofPage.connectedAddressText).toBeVisible();
    await expect(page.getByText(SYNTHETIC_WORKER_ADDRESS)).toBeVisible();
    await expect(proofPage.disconnectButton).toBeVisible();

    // The challenge/verify handshake actually happened against the mocked
    // API, not just client-side state.
    expect(apiMock.authRequests).toEqual([{ walletAddress: SYNTHETIC_WORKER_ADDRESS }]);

    // Session persists across a reload (localStorage-backed).
    await page.reload();
    await expect(proofPage.connectedAddressText).toBeVisible();

    const storedSession = await page.evaluate(() => window.localStorage.getItem("earnproof.session"));
    expect(storedSession).toContain(SYNTHETIC_SESSION_TOKEN);
  });

  test("surfaces an error when the wallet declines access instead of silently failing", async ({
    page,
    freighter,
  }) => {
    await freighter({ denyAccess: true });
    const proofPage = new ProofCreationPage(page);
    await proofPage.goto();

    await proofPage.connectButton.click();

    await expect(proofPage.walletErrorText).toBeVisible();
    // No session should have been established.
    await expect(proofPage.connectButton).toBeVisible();
  });

  test("disconnect clears the local session and returns to the connect state", async ({
    page,
    freighter,
  }) => {
    await freighter();
    const proofPage = new ProofCreationPage(page);
    await proofPage.goto();
    await proofPage.connectButton.click();
    await expect(proofPage.disconnectButton).toBeVisible();

    await proofPage.disconnectButton.click();

    await expect(proofPage.connectButton).toBeVisible();
    const storedSession = await page.evaluate(() => window.localStorage.getItem("earnproof.session"));
    expect(storedSession).toBeNull();
  });
});
