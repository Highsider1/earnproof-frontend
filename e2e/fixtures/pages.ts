import type { Locator, Page } from "@playwright/test";

/**
 * Page objects for the flows that exist in the app today (wallet connect,
 * payment sync/classification, minimum-income proof creation, public proof
 * verification, and public credential verification).
 *
 * There is intentionally no DashboardPage / PaymentsSelectionPage /
 * HistoryPage / RevocationPage here yet — those UI surfaces do not exist in
 * the app. This file is structured so a future spec can add one alongside
 * these without reshaping what already exists: keep the same "locators as
 * methods, one class per route" shape and register it below.
 */

export class ProofCreationPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/proofs");
  }

  get connectButton(): Locator {
    return this.page.getByRole("button", { name: "Connect Freighter" });
  }

  get disconnectButton(): Locator {
    return this.page.getByRole("button", { name: "Disconnect" });
  }

  get connectedAddressText(): Locator {
    return this.page.getByText("Connected as");
  }

  get syncButton(): Locator {
    return this.page.getByRole("button", { name: "Sync" });
  }

  get refreshButton(): Locator {
    return this.page.getByRole("button", { name: "Refresh" });
  }

  get walletErrorText(): Locator {
    return this.page.getByText("Freighter was not found");
  }

  paymentRow(transactionHashSnippet: string): Locator {
    return this.page.locator("div").filter({ hasText: transactionHashSnippet }).last();
  }

  paymentCheckbox(index: number): Locator {
    return this.page.getByLabel("Select payment").nth(index);
  }

  classificationSelect(index: number): Locator {
    return this.page.locator("select").nth(index);
  }

  get thresholdInput(): Locator {
    return this.page.getByLabel("Threshold");
  }

  get periodStartInput(): Locator {
    return this.page.getByLabel("Period start");
  }

  get periodEndInput(): Locator {
    return this.page.getByLabel("Period end");
  }

  get createProofButton(): Locator {
    return this.page.getByRole("button", { name: "Create proof" });
  }

  get statusMessage(): Locator {
    return this.page.locator("section").last().getByText(/Wallet authenticated|Payments synced|Creating signed|Proof created|Requesting Freighter|Waiting for wallet/);
  }

  get proofIdText(): Locator {
    return this.page.getByText("Proof ID:");
  }

  get credentialHashText(): Locator {
    return this.page.getByText("Credential hash:");
  }

  get openVerificationLink(): Locator {
    return this.page.getByRole("link", { name: "Open public verification" });
  }

  get errorMessage(): Locator {
    return this.page.locator("p.text-rose-200");
  }
}

export class VerifyProofPage {
  constructor(private readonly page: Page) {}

  async goto(query?: string) {
    await this.page.goto(query ? `/verify?${query}` : "/verify");
  }

  get proofIdInput(): Locator {
    return this.page.getByLabel("Proof ID");
  }

  get verifyButton(): Locator {
    return this.page.getByRole("button", { name: /Verify proof|Checking/ });
  }

  get statusBadge(): Locator {
    return this.page.locator("div.inline-flex.rounded-md.border");
  }

  get errorMessage(): Locator {
    return this.page.getByText("Verification request failed");
  }

  resultField(label: string): Locator {
    return this.page.locator("dt", { hasText: label }).locator("xpath=following-sibling::dd[1]");
  }
}

export class VerifyCredentialPage {
  constructor(private readonly page: Page) {}

  async goto() {
    await this.page.goto("/verify/credential");
  }

  get credentialJsonInput(): Locator {
    return this.page.getByLabel("Credential JSON", { exact: true });
  }

  get validateButton(): Locator {
    return this.page.getByRole("button", { name: /Validate credential|Checking/ });
  }

  get errorMessage(): Locator {
    return this.page.getByText("Enter valid credential JSON");
  }

  get statusBadge(): Locator {
    return this.page.locator("div.inline-flex.rounded-md.border");
  }
}
