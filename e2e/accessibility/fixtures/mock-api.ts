import type { Page } from "@playwright/test";

const API_BASE = "http://127.0.0.1:4000/api/v1";

const PAYMENT = {
  id: "pay_1",
  stellarTransactionHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  sourceAddress: "GSOURCEADDRESSEXAMPLE0000000000000000000000000",
  assetCode: "USDC",
  assetIssuer: null,
  occurredAt: "2026-08-01T12:00:00.000Z",
  classification: "INCOME",
  isEligible: true,
};

const PROOF_RESPONSE = {
  proofId: "EP-8A42-91DC",
  status: "issued",
  verificationUrl: "https://example.com/verify?proof=EP-8A42-91DC",
  credential: {
    proof: {
      credentialHash: "hash-example-0000000000000000000000000000000000",
      signature: "signature-example",
    },
  },
};

/**
 * Installs deterministic mocks for the EarnProof API so the create-proof
 * flow can be driven end to end (loading, success, and error states)
 * without a live backend. Self-contained to this PR.
 */
export async function mockEarnProofApi(
  page: Page,
  options?: { failAuth?: boolean; failProofCreation?: boolean; delayMs?: number },
) {
  const delay = options?.delayMs ?? 0;

  await page.route(`${API_BASE}/auth/challenge`, async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        id: "challenge_1",
        message: "Sign in to EarnProof: challenge_1",
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      }),
    });
  });

  await page.route(`${API_BASE}/auth/verify`, async (route) => {
    if (options?.failAuth) {
      await route.fulfill({ status: 401, contentType: "application/json", body: "{}" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "user_1",
          walletAddress: "GAEXAMPLEACCOUNTIDENARSTELLARTESTNETWALLET0000",
          walletHash: "hash_1",
          role: "worker",
        },
        session: { token: "mock-token", tokenType: "Bearer" },
      }),
    });
  });

  await page.route(`${API_BASE}/payments/sync`, async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route(`${API_BASE}/payments`, async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([PAYMENT]),
    });
  });

  await page.route(`${API_BASE}/payments/*/classification`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PAYMENT),
    });
  });

  await page.route(`${API_BASE}/proofs/minimum-income`, async (route) => {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));

    if (options?.failProofCreation) {
      await route.fulfill({ status: 500, contentType: "application/json", body: "{}" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PROOF_RESPONSE),
    });
  });
}

/** Mocks the public proof-verification lookup used by the verify pages. */
export async function mockVerifyApi(
  page: Page,
  options?: { status?: "valid" | "unknown"; delayMs?: number },
) {
  const status = options?.status ?? "valid";

  await page.route(`${API_BASE}/proofs/**/verify`, async (route) => {
    if (options?.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));

    if (status === "unknown") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: "UNKNOWN_PROOF", status: "unknown" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        result: "VALID",
        status: "valid",
        credential: {
          id: "EP-8A42-91DC",
          schemaVersion: "1.0",
          subject: { walletHash: "hash_1" },
          claim: {
            operator: "gte",
            thresholdAmount: "100",
            assetCode: "USDC",
            assetIssuer: null,
            periodStart: "2026-08-01T00:00:00.000Z",
            periodEnd: "2026-08-31T23:59:59.000Z",
            qualifyingPaymentCount: 1,
          },
          privacy: { exactIncomeHidden: true, sourceTransactionsHidden: true },
          issuedAt: "2026-08-01T12:00:00.000Z",
          expiresAt: "2026-09-01T12:00:00.000Z",
          proof: {
            type: "Ed25519Signature2020",
            credentialHash: "hash-example",
            signature: "signature-example",
          },
        },
        proof: {
          id: "EP-8A42-91DC",
          type: "MinimumIncomeProof",
          schemaVersion: "1.0",
          network: "testnet",
          issuedAt: "2026-08-01T12:00:00.000Z",
          expiresAt: "2026-09-01T12:00:00.000Z",
          revokedAt: null,
        },
      }),
    });
  });
}
