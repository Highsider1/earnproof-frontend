import type { ProofIntent } from "./idempotency";

/**
 * The exact wire body sent to POST /proofs/minimum-income, and nothing
 * else. Building this as a pure function of the intent (rather than
 * inline at submit time, as this call site previously did) is what makes
 * "the reviewed payload is byte-equivalent to the submitted payload"
 * possible: the review step and the submit call both derive from calling
 * this same function once, so there is no second, independently-written
 * object literal that could drift from what the user reviewed.
 */
export type MinimumIncomeProofPayload = {
  selectedPaymentIds: string[];
  thresholdAmount: string;
  assetCode: string;
  assetIssuer?: string;
  periodStart: string;
  periodEnd: string;
  expiresInDays: number;
};

/** Default validity window for a minimum-income proof, in days. Previously
 * inlined directly into the submit call and never surfaced anywhere in the
 * UI — pulled out here so a review screen can actually display it. */
export const DEFAULT_PROOF_EXPIRES_IN_DAYS = 30;

export function buildMinimumIncomeProofPayload(
  intent: ProofIntent,
  expiresInDays: number = DEFAULT_PROOF_EXPIRES_IN_DAYS,
): MinimumIncomeProofPayload {
  return {
    selectedPaymentIds: intent.selectedPaymentIds,
    thresholdAmount: intent.thresholdAmount,
    assetCode: intent.assetCode,
    assetIssuer: intent.assetIssuer,
    periodStart: intent.periodStart,
    periodEnd: intent.periodEnd,
    expiresInDays,
  };
}
