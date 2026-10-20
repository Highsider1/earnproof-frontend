import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { ProofCreationPage } from "./pages";

/**
 * Shared multi-step flow: navigate to the proof creation page and complete
 * wallet connect + challenge/verify. Every spec that needs an authenticated
 * session starts here so the auth mechanics live in one place.
 */
export async function connectAndAuthenticate(page: Page): Promise<ProofCreationPage> {
  const proofPage = new ProofCreationPage(page);
  await proofPage.goto();
  await proofPage.connectButton.click();
  await expect(proofPage.connectedAddressText).toBeVisible();
  return proofPage;
}
