/**
 * Synthetic fixture data for worker proof lifecycle e2e coverage.
 *
 * Nothing in this file is a real wallet secret, a real Stellar address, or
 * data captured from a live network. Every identifier is deliberately shaped
 * to look plausible (correct lengths / prefixes) while being obviously
 * synthetic on inspection, so it is safe to keep in the repository and safe
 * to leave in any test artifact (trace, screenshot, HAR).
 */

function padToLength(prefix: string, length: number) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let value = prefix;
  let i = 0;
  while (value.length < length) {
    value += alphabet[i % alphabet.length];
    i += 1;
  }
  return value.slice(0, length);
}

/** 56-char Stellar-shaped address for the worker connecting a wallet. */
export const SYNTHETIC_WORKER_ADDRESS = padToLength("GSYNTHETICWORKERWALLET", 56);

/** A different synthetic address used for the counterparty of payments. */
export const SYNTHETIC_PAYER_ADDRESS = padToLength("GSYNTHETICPAYERWALLET", 56);

/** Secret-shaped value that must never be sent anywhere but is referenced to
 * document what "real" Freighter usage looks like; the mock never uses a
 * real seed and no signing key material exists in this repository. */
export const SYNTHETIC_WALLET_HASH = "wh_" + padToLength("SYNTHETICHASH", 40).toLowerCase();

export const SYNTHETIC_SESSION_TOKEN = "e2e-synthetic-session-token.do-not-use";

export const SYNTHETIC_USER = {
  id: "user_e2e_0001",
  walletAddress: SYNTHETIC_WORKER_ADDRESS,
  walletHash: SYNTHETIC_WALLET_HASH,
  role: "WORKER",
};

export const SYNTHETIC_CHALLENGE = {
  id: "chal_e2e_0001",
  message: "earnproof-e2e-challenge:synthetic-nonce-0001",
  expiresAt: "2026-08-26T23:59:59.000Z",
};

export type SyntheticPayment = {
  id: string;
  stellarTransactionHash: string;
  sourceAddress: string;
  assetCode: string;
  assetIssuer: string | null;
  occurredAt: string;
  classification: "INCOME" | "REIMBURSEMENT" | "PERSONAL_TRANSFER" | "UNKNOWN" | "EXCLUDED";
  isEligible: boolean;
};

/**
 * A mixed batch of payments: eligible income, an already-classified
 * reimbursement, and an unclassified payment the test can reclassify. This
 * lets specs assert that only eligible INCOME rows become selectable.
 */
export const SYNTHETIC_PAYMENTS: SyntheticPayment[] = [
  {
    id: "pay_e2e_0001",
    stellarTransactionHash: padToLength("txsynthetic0001", 64).toLowerCase(),
    sourceAddress: SYNTHETIC_PAYER_ADDRESS,
    assetCode: "USDC",
    assetIssuer: padToLength("GSYNTHETICUSDCISSUER", 56),
    occurredAt: "2026-08-05T10:15:00.000Z",
    classification: "INCOME",
    isEligible: true,
  },
  {
    id: "pay_e2e_0002",
    stellarTransactionHash: padToLength("txsynthetic0002", 64).toLowerCase(),
    sourceAddress: SYNTHETIC_PAYER_ADDRESS,
    assetCode: "USDC",
    assetIssuer: padToLength("GSYNTHETICUSDCISSUER", 56),
    occurredAt: "2026-08-12T09:30:00.000Z",
    classification: "INCOME",
    isEligible: true,
  },
  {
    id: "pay_e2e_0003",
    stellarTransactionHash: padToLength("txsynthetic0003", 64).toLowerCase(),
    sourceAddress: SYNTHETIC_PAYER_ADDRESS,
    assetCode: "USDC",
    assetIssuer: padToLength("GSYNTHETICUSDCISSUER", 56),
    occurredAt: "2026-08-14T09:30:00.000Z",
    classification: "REIMBURSEMENT",
    isEligible: false,
  },
  {
    id: "pay_e2e_0004",
    stellarTransactionHash: padToLength("txsynthetic0004", 64).toLowerCase(),
    sourceAddress: SYNTHETIC_PAYER_ADDRESS,
    assetCode: "USDC",
    assetIssuer: padToLength("GSYNTHETICUSDCISSUER", 56),
    occurredAt: "2026-08-18T09:30:00.000Z",
    classification: "UNKNOWN",
    isEligible: false,
  },
];

export const SYNTHETIC_PROOF_ID = "EP-E2E1-0001";

export const SYNTHETIC_CREDENTIAL_HASH = padToLength("credentialhashsynthetic", 64).toLowerCase();
export const SYNTHETIC_SIGNATURE = padToLength("signaturesynthetic", 88).toLowerCase();

export const SYNTHETIC_CREATE_PROOF_RESPONSE = {
  proofId: SYNTHETIC_PROOF_ID,
  status: "issued",
  verificationUrl: `https://earnproof.example/verify?proof=${SYNTHETIC_PROOF_ID}`,
  credential: {
    proof: {
      credentialHash: SYNTHETIC_CREDENTIAL_HASH,
      signature: SYNTHETIC_SIGNATURE,
    },
  },
};

/** Fields that are intentionally never present in a public verification
 * response. Specs assert none of these leak into the rendered DOM. */
export const PROTECTED_FIELDS = {
  sessionToken: SYNTHETIC_SESSION_TOKEN,
  walletAddress: SYNTHETIC_WORKER_ADDRESS,
  payerAddress: SYNTHETIC_PAYER_ADDRESS,
  paymentTransactionHashes: SYNTHETIC_PAYMENTS.map((payment) => payment.stellarTransactionHash),
};

function buildVerifyResponse(overrides: {
  status: "valid" | "expired" | "revoked" | "unknown" | "invalid";
  result: "VALID" | "EXPIRED" | "REVOKED" | "INVALID_SIGNATURE" | "UNKNOWN_PROOF" | "UNVERIFIED_ISSUER";
  revokedAt?: string | null;
  includeCredential?: boolean;
}) {
  const includeCredential = overrides.includeCredential ?? true;

  return {
    result: overrides.result,
    status: overrides.status,
    ...(includeCredential
      ? {
          credential: {
            id: SYNTHETIC_PROOF_ID,
            schemaVersion: "1.0",
            subject: {
              walletHash: SYNTHETIC_WALLET_HASH,
            },
            claim: {
              operator: "gte" as const,
              thresholdAmount: "100",
              assetCode: "USDC",
              assetIssuer: padToLength("GSYNTHETICUSDCISSUER", 56),
              periodStart: "2026-08-01T00:00:00.000Z",
              periodEnd: "2026-08-31T23:59:59.000Z",
              qualifyingPaymentCount: 2,
            },
            privacy: {
              exactIncomeHidden: true,
              sourceTransactionsHidden: true,
            },
            issuedAt: "2026-08-19T00:00:00.000Z",
            expiresAt: "2026-09-18T00:00:00.000Z",
            proof: {
              type: "EarnProofMinimumIncomeCredential",
              credentialHash: SYNTHETIC_CREDENTIAL_HASH,
              signature: SYNTHETIC_SIGNATURE,
            },
          },
          proof: {
            id: SYNTHETIC_PROOF_ID,
            type: "EarnProofMinimumIncomeCredential",
            schemaVersion: "1.0",
            network: "stellar:testnet",
            issuedAt: "2026-08-19T00:00:00.000Z",
            expiresAt: "2026-09-18T00:00:00.000Z",
            revokedAt: overrides.revokedAt ?? null,
          },
        }
      : {}),
  };
}

export const SYNTHETIC_VERIFY_RESPONSES = {
  valid: buildVerifyResponse({ status: "valid", result: "VALID" }),
  expired: buildVerifyResponse({ status: "expired", result: "EXPIRED" }),
  revoked: buildVerifyResponse({
    status: "revoked",
    result: "REVOKED",
    revokedAt: "2026-08-25T12:00:00.000Z",
  }),
  unknown: buildVerifyResponse({
    status: "unknown",
    result: "UNKNOWN_PROOF",
    includeCredential: false,
  }),
};

export const SYNTHETIC_CREDENTIAL_UPLOAD = {
  id: SYNTHETIC_PROOF_ID,
  note: "Synthetic credential JSON used only for e2e upload coverage.",
};
