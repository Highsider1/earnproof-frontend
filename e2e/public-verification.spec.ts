import { test, expect } from "./fixtures/test";
import { VerifyProofPage, VerifyCredentialPage } from "./fixtures/pages";
import {
  SYNTHETIC_PROOF_ID,
  SYNTHETIC_VERIFY_RESPONSES,
  PROTECTED_FIELDS,
} from "./fixtures/synthetic-data";

test.describe("public proof verification", () => {
  test("a valid proof ID resolves to the public disclosure summary", async ({ page }) => {
    const verifyPage = new VerifyProofPage(page);
    await verifyPage.goto();

    await verifyPage.proofIdInput.fill(SYNTHETIC_PROOF_ID);
    await verifyPage.verifyButton.click();

    await expect(verifyPage.statusBadge).toHaveText("valid");
    await expect(verifyPage.resultField("Proof ID")).toHaveText(SYNTHETIC_PROOF_ID);
    await expect(verifyPage.resultField("Qualifying payments")).toHaveText("2");
  });

  test("proof ID pre-fills from a verification URL query param", async ({ page }) => {
    const verifyPage = new VerifyProofPage(page);
    await verifyPage.goto(`proof=${SYNTHETIC_PROOF_ID}`);
    await expect(verifyPage.proofIdInput).toHaveValue(SYNTHETIC_PROOF_ID);
  });

  test("an expired proof is labeled expired, not silently treated as valid", async ({ page, apiMock }) => {
    apiMock.setVerifyOutcome("expired");
    const verifyPage = new VerifyProofPage(page);
    await verifyPage.goto();
    await verifyPage.proofIdInput.fill(SYNTHETIC_PROOF_ID);
    await verifyPage.verifyButton.click();

    await expect(verifyPage.statusBadge).toHaveText("expired");
  });

  test("a revoked proof is labeled revoked and still discloses only public fields", async ({
    page,
    apiMock,
  }) => {
    apiMock.setVerifyOutcome("revoked");
    const verifyPage = new VerifyProofPage(page);
    await verifyPage.goto();
    await verifyPage.proofIdInput.fill(SYNTHETIC_PROOF_ID);
    await verifyPage.verifyButton.click();

    await expect(verifyPage.statusBadge).toHaveText("revoked");
    await expect(verifyPage.resultField("Proof ID")).toHaveText(SYNTHETIC_PROOF_ID);
  });

  test("an unknown proof ID shows no credential rather than leaking a default record", async ({
    page,
  }) => {
    const verifyPage = new VerifyProofPage(page);
    await verifyPage.goto();
    await verifyPage.proofIdInput.fill("UNKNOWN-PROOF-ID");
    await verifyPage.verifyButton.click();

    await expect(verifyPage.statusBadge).toHaveText("unknown");
    await expect(page.getByText("No matching EarnProof credential was found")).toBeVisible();
  });

  test.describe("privacy boundaries", () => {
    for (const outcome of ["valid", "expired", "revoked"] as const) {
      test(`the ${outcome} disclosure never renders session, wallet, or payment secrets`, async ({
        page,
        apiMock,
      }) => {
        apiMock.setVerifyOutcome(outcome);
        const verifyPage = new VerifyProofPage(page);
        await verifyPage.goto();
        await verifyPage.proofIdInput.fill(SYNTHETIC_PROOF_ID);
        await verifyPage.verifyButton.click();
        await expect(verifyPage.statusBadge).toHaveText(outcome);

        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toContain(PROTECTED_FIELDS.sessionToken);
        expect(bodyText).not.toContain(PROTECTED_FIELDS.walletAddress);
        expect(bodyText).not.toContain(PROTECTED_FIELDS.payerAddress);
        for (const hash of PROTECTED_FIELDS.paymentTransactionHashes) {
          expect(bodyText).not.toContain(hash);
        }

        // Only a wallet *hash* — never the raw wallet address — appears,
        // and only in the credential's subject field.
        const walletHash = SYNTHETIC_VERIFY_RESPONSES[outcome].credential?.subject.walletHash;
        if (walletHash) {
          expect(bodyText).toContain(walletHash);
        }
      });
    }
  });
});

test.describe("public credential verification", () => {
  test("uploading a credential's JSON resolves the same public disclosure summary", async ({
    page,
  }) => {
    const credentialPage = new VerifyCredentialPage(page);
    await credentialPage.goto();

    await credentialPage.credentialJsonInput.fill(JSON.stringify({ id: SYNTHETIC_PROOF_ID }));
    await credentialPage.validateButton.click();

    await expect(credentialPage.statusBadge).toHaveText("valid");
  });

  test("rejects malformed JSON without making a network request", async ({ page, apiMock }) => {
    const credentialPage = new VerifyCredentialPage(page);
    await credentialPage.goto();

    await credentialPage.credentialJsonInput.fill("{not valid json");
    await credentialPage.validateButton.click();

    await expect(credentialPage.errorMessage).toBeVisible();
    expect(apiMock.verifyRequests).toEqual([]);
  });
});
