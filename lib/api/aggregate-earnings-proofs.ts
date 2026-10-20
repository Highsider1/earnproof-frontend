import { apiClient, bearer, retryMutation } from "./client";

/**
 * SUM is the only aggregation policy the backend supports today. The type
 * stays a union (not a literal "SUM") so a second policy can be added later
 * without widening every call site from scratch — see
 * validateAggregationPolicy(), which is the single place that currently
 * enforces "only SUM," and getUnsupportedAggregationReason(), which explains
 * why an eligible-looking source set can't use it (see issue #166: "explain
 * when cross-asset aggregation is unavailable").
 */
export type AggregationPolicy = "SUM";

export const SUPPORTED_AGGREGATION_POLICIES: Array<{
  value: AggregationPolicy;
  label: string;
  description: string;
}> = [{ value: "SUM", label: "Sum", description: "Add up all selected sources' qualifying payments." }];

export type CreateAggregateEarningsProofRequest = {
  selectedPaymentIds: string[];
  aggregationPolicy: AggregationPolicy;
  assetCode: string;
  assetIssuer?: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  expiresInDays?: number;
};

export type AggregateEarningsProof = {
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
      aggregationPolicy: AggregationPolicy;
      assetCode: string;
      assetIssuer?: string | null;
      periodStart: string;
      periodEnd: string;
      sourceCount: number;
      qualifyingPaymentCount: number;
    };
    privacy: {
      exactAggregateHidden: boolean;
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

export async function createAggregateEarningsProof(
  token: string,
  request: CreateAggregateEarningsProofRequest,
  signal: AbortSignal,
  idempotencyKey?: string
): Promise<AggregateEarningsProof> {
  return retryMutation(async (signal) => {
    return apiClient<AggregateEarningsProof>({
      path: "/proofs/aggregate-earnings",
      method: "POST",
      headers: idempotencyKey ? { ...bearer(token), "Idempotency-Key": idempotencyKey } : bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

/** A source is one distinct (assetCode, assetIssuer) pair among eligible income payments. */
export type EarningsSource = {
  assetCode: string;
  assetIssuer: string | null;
  paymentCount: number;
};

export function deriveEarningsSources(
  payments: Array<{ assetCode: string; assetIssuer: string | null; classification: string; isEligible: boolean }>
): EarningsSource[] {
  const bySourceKey = new Map<string, EarningsSource>();
  for (const payment of payments) {
    if (!payment.isEligible || payment.classification !== "INCOME") {
      continue;
    }
    const key = `${payment.assetCode}:${payment.assetIssuer ?? "native"}`;
    const existing = bySourceKey.get(key);
    if (existing) {
      existing.paymentCount += 1;
    } else {
      bySourceKey.set(key, { assetCode: payment.assetCode, assetIssuer: payment.assetIssuer, paymentCount: 1 });
    }
  }
  return Array.from(bySourceKey.values());
}

/**
 * SUM only supports a single asset today: mixing assets would require a
 * conversion rate the backend doesn't provide, and silently picking one
 * would misrepresent the aggregate. See issue #166's "unsupported
 * conversion assumptions are never introduced by the UI."
 */
export function getUnsupportedAggregationReason(
  selectedSources: EarningsSource[],
  policy: AggregationPolicy
): string | null {
  if (selectedSources.length === 0) {
    return null;
  }
  const distinctAssets = new Set(selectedSources.map((source) => `${source.assetCode}:${source.assetIssuer ?? "native"}`));
  if (distinctAssets.size > 1) {
    return `${policy} aggregation across multiple assets is not supported. Select sources that share a single asset.`;
  }
  return null;
}

export function validateAggregationPolicy(policy: AggregationPolicy | undefined): string | null {
  if (!policy) {
    return "An aggregation policy is required";
  }
  if (!SUPPORTED_AGGREGATION_POLICIES.some((supported) => supported.value === policy)) {
    return `${policy} is not a supported aggregation policy`;
  }
  return null;
}

export function validateSourceSelection(
  selectedPaymentIds: string[],
  selectedSources: EarningsSource[],
  policy: AggregationPolicy | undefined
): string | null {
  if (selectedPaymentIds.length === 0) {
    return "Select at least one eligible payment";
  }
  const policyError = validateAggregationPolicy(policy);
  if (policyError) {
    return policyError;
  }
  return getUnsupportedAggregationReason(selectedSources, policy!);
}

export function formatAggregationPolicy(policy: AggregationPolicy): string {
  return SUPPORTED_AGGREGATION_POLICIES.find((supported) => supported.value === policy)?.label ?? policy;
}
