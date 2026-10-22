/**
 * Synthetic, fully-fabricated fixture data for the visual regression
 * suite. Nothing here is a real Stellar address, transaction hash,
 * wallet, or credential. Every id/hash/timestamp is a fixed literal so
 * screenshots are byte-for-byte deterministic across runs.
 */

export const FIXTURE_WALLET_ADDRESS =
  "GDXVISUALTESTFIXTUREWALLET0000000000000000000000000000000A";

export const FIXTURE_SESSION = {
  token: "visual-fixture-session-token",
  user: {
    id: "fixture-user-1",
    walletAddress: FIXTURE_WALLET_ADDRESS,
    walletHash: "fixture-wallet-hash-0001",
    role: "worker",
  },
};

export const EMPTY_PAYMENTS: unknown[] = [];

export const FIXTURE_PAYMENTS = [
  {
    id: "fixture-payment-1",
    stellarTransactionHash:
      "aaaaaaaa00000000000000000000000000000000000000000000000000aa",
    sourceAddress: "GDXVISUALTESTFIXTURESOURCE000000000000000000000000000001",
    assetCode: "USDC",
    assetIssuer: "GDXVISUALTESTFIXTUREISSUER00000000000000000000000000000B",
    occurredAt: "2026-08-01T12:00:00.000Z",
    classification: "INCOME",
    isEligible: true,
  },
  {
    id: "fixture-payment-2",
    stellarTransactionHash:
      "bbbbbbbb00000000000000000000000000000000000000000000000000bb",
    sourceAddress: "GDXVISUALTESTFIXTURESOURCE000000000000000000000000000002",
    assetCode: "USDC",
    assetIssuer: "GDXVISUALTESTFIXTUREISSUER00000000000000000000000000000B",
    occurredAt: "2026-08-08T09:30:00.000Z",
    classification: "REIMBURSEMENT",
    isEligible: false,
  },
  {
    id: "fixture-payment-3",
    stellarTransactionHash:
      "cccccccc00000000000000000000000000000000000000000000000000cc",
    sourceAddress: "GDXVISUALTESTFIXTURESOURCE000000000000000000000000000003",
    assetCode: "XLM",
    assetIssuer: null,
    occurredAt: "2026-08-15T18:45:00.000Z",
    classification: "UNKNOWN",
    isEligible: false,
  },
];

export const FIXTURE_PROOF = {
  proofId: "EP-FIXT-0001",
  status: "issued",
  verificationUrl: "https://example.invalid/verify?proof=EP-FIXT-0001",
  credential: {
    proof: {
      credentialHash:
        "fixture0000000000000000000000000000000000000000000000000000ab",
      signature:
        "fixturesig00000000000000000000000000000000000000000000000000cd",
    },
  },
};

export const FIXTURE_VERIFY_VALID = {
  result: "VALID",
  status: "valid",
  credential: {
    id: "EP-FIXT-0001",
    schemaVersion: "1.0",
    subject: { walletHash: "fixture-wallet-hash-0001" },
    claim: {
      operator: "gte",
      thresholdAmount: "100",
      assetCode: "USDC",
      assetIssuer: "GDXVISUALTESTFIXTUREISSUER00000000000000000000000000000B",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.000Z",
      qualifyingPaymentCount: 1,
    },
    privacy: {
      exactIncomeHidden: true,
      sourceTransactionsHidden: true,
    },
    issuedAt: "2026-08-16T00:00:00.000Z",
    expiresAt: "2026-09-15T00:00:00.000Z",
    proof: {
      type: "EarnProofMinimumIncome",
      credentialHash:
        "fixture0000000000000000000000000000000000000000000000000000ab",
      signature:
        "fixturesig00000000000000000000000000000000000000000000000000cd",
    },
  },
  proof: {
    id: "EP-FIXT-0001",
    type: "EarnProofMinimumIncome",
    schemaVersion: "1.0",
    network: "Stellar Testnet",
    issuedAt: "2026-08-16T00:00:00.000Z",
    expiresAt: "2026-09-15T00:00:00.000Z",
    revokedAt: null,
  },
};

export const FIXTURE_VERIFY_REVOKED = {
  result: "REVOKED",
  status: "revoked",
};

export const FIXTURE_VERIFY_UNKNOWN = {
  result: "UNKNOWN_PROOF",
  status: "unknown",
};
