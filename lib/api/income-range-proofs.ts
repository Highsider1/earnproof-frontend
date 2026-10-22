import { apiClient, bearer, retryMutation } from "./client";
import { parseAssetAmount, formatStroops } from "@/lib/i18n";

export type CreateIncomeRangeProofRequest = {
  selectedPaymentIds: string[];
  lowerBound: string;
  upperBound: string;
  assetCode: string;
  assetIssuer?: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  expiresInDays?: number;
};

export type IncomeRangeProof = {
  proofId: string;
  status: string;
  verificationUrl: string;
  credential: {
    id: string;
    type: string;
    schemaVersion: string;
    subject: {
      walletHash: string;
    };
    claim: {
      lowerBound: string;
      upperBound: string;
      assetCode: string;
      assetIssuer?: string | null;
      periodStart: string;
      periodEnd: string;
      qualifyingPaymentCount: number;
    };
    privacy: {
      exactIncomeHidden: boolean;
      sourceTransactionsHidden: boolean;
    };
    issuedAt: string;
    expiresAt: string;
    proof: {
      type: string;
      credentialHash: string;
      signature: string;
    };
  };
};

export async function createIncomeRangeProof(
  token: string,
  request: CreateIncomeRangeProofRequest,
  signal: AbortSignal,
  idempotencyKey?: string
): Promise<IncomeRangeProof> {
  return retryMutation(async (signal) => {
    return apiClient<IncomeRangeProof>({
      path: "/proofs/income-range",
      method: "POST",
      headers: idempotencyKey ? { ...bearer(token), "Idempotency-Key": idempotencyKey } : bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

/**
 * The maximum precision a range proof may express, in the same units as
 * lowerBound/upperBound. A range narrower than this effectively discloses
 * the exact income (an "over-precise" range per issue #162's acceptance
 * criteria) rather than a genuine range, defeating the point of this proof
 * type over minimum-income's threshold claim.
 */
export const MIN_RANGE_WIDTH = 50;

export function validateIncomeRange(
  lowerBound: string | undefined,
  upperBound: string | undefined
): string | null {
  if (!lowerBound?.trim()) {
    return "A lower bound is required";
  }
  if (!upperBound?.trim()) {
    return "An upper bound is required";
  }

  const lower = Number(lowerBound);
  const upper = Number(upperBound);

  if (!Number.isFinite(lower) || !Number.isFinite(upper)) {
    return "Bounds must be numeric";
  }
  if (lower < 0 || upper < 0) {
    return "Bounds cannot be negative";
  }
  if (lower >= upper) {
    return "Upper bound must be greater than the lower bound";
  }
  if (upper - lower < MIN_RANGE_WIDTH) {
    return `The range must span at least ${MIN_RANGE_WIDTH} to avoid disclosing an exact amount`;
  }

  return null;
}

/**
 * Formats an income range for display, e.g. "1,250 - 3,000 USDC". Uses the
 * shared asset-aware formatter (lib/i18n/amount.ts) so the bounds are
 * grouped and decimal-safe rather than shown as raw API strings; falls back
 * to the raw bounds if either fails to parse, rather than crashing the
 * render (this is API display data, per this file's other functions'
 * error-tolerant conventions).
 */
export function formatIncomeRange(lowerBound: string, upperBound: string, assetCode: string): string {
  const lower = parseAssetAmount(lowerBound);
  const upper = parseAssetAmount(upperBound);

  if (!lower.ok || !upper.ok) {
    return `${lowerBound} - ${upperBound} ${assetCode}`;
  }

  return `${formatStroops(lower.stroops)} - ${formatStroops(upper.stroops)} ${assetCode}`;
}
