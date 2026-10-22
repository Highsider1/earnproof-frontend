import { apiClient, bearer, retryMutation } from "./client";

/**
 * Employer-payment proof: a minimal-disclosure proof that a worker
 * received payment(s) from a specific, eligible employer source within a
 * bounded period — WITHOUT disclosing exact transaction amounts. This is
 * intentionally distinct from the existing payment-receipt proof
 * (`lib/api/payment-receipt-proofs.ts`), which proves receipt of one
 * specific payment and lets the worker opt into disclosing its exact
 * amount. This wizard has no amount field in its request shape at all —
 * there is no way to opt into amount disclosure, by design (see
 * `CreateEmployerPaymentProofRequest` below).
 *
 * NOTE: `/proofs/employer-payment` is not yet defined in
 * `lib/api/openapi/earnproof-api.v1.json`. This module follows the same
 * request/response conventions as the sibling payment-receipt and
 * recurring-income proof clients (REST under `/proofs`, bearer auth,
 * `apiClient` + `retryMutation`) so it can be wired up with no shape
 * changes once the endpoint ships. Not registered in
 * `lib/api/client-contracts.json` since the schema isn't in the OpenAPI
 * spec yet.
 *
 * Employer source model: the current API has no organization- or
 * issuer-level wallet address (`Organization`/`Issuer` in the OpenAPI
 * spec carry no wallet field), so there is no server-verifiable link
 * between a payment's `sourceAddress` and a specific registered employer
 * today. Given that constraint, this module derives candidate "employer
 * sources" from the worker's own synced payments, grouped by
 * `sourceAddress`, using the existing payment classification/eligibility
 * fields as the trust signal:
 *  - eligible, INCOME-classified payments from a source -> a trusted,
 *    selectable source
 *  - EXCLUDED or ineligible payments from a source -> untrusted/revoked,
 *    never selectable
 * This is a deliberate frontend approximation pending a real
 * employer-registry endpoint; see the PR description for the full
 * rationale.
 */

export type PaymentClassification =
  | "INCOME"
  | "REIMBURSEMENT"
  | "PERSONAL_TRANSFER"
  | "UNKNOWN"
  | "EXCLUDED";

export type Payment = {
  id: string;
  stellarTransactionHash: string;
  sourceAddress: string;
  assetCode: string;
  assetIssuer: string | null;
  occurredAt: string;
  classification: PaymentClassification;
  isEligible: boolean;
};

export type EmployerSourceTrust = "TRUSTED" | "UNTRUSTED";

/**
 * A candidate employer source: one distinct `sourceAddress` among the
 * worker's payments, summarized (never showing individual transaction
 * amounts) for selection in the wizard.
 */
export type EmployerSource = {
  sourceAddress: string;
  trust: EmployerSourceTrust;
  /** Count only — never the summed/individual amounts. */
  paymentCount: number;
  assetCodes: string[];
  firstPaymentAt: string;
  lastPaymentAt: string;
};

export type CreateEmployerPaymentProofRequest = {
  sourceAddress: string;
  periodStart: string;
  periodEnd: string;
  assetCode: string;
  assetIssuer?: string;
  expiresInDays?: number;
  // Deliberately no amount / discloseAmount field: this proof type can
  // never carry an exact payment amount, minimal-disclosure by
  // construction rather than by an opt-out flag a caller could get wrong.
};

export type EmployerPaymentProof = {
  proofId: string;
  status: string;
  verificationUrl: string;
  credential: {
    id: string;
    type: string;
    schemaVersion: string;
    subject: { walletHash: string };
    claim: {
      sourceAddressHash: string;
      assetCode: string;
      assetIssuer?: string | null;
      periodStart: string;
      periodEnd: string;
      qualifyingPaymentCount: number;
    };
    privacy: {
      exactAmountHidden: true;
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

export async function createEmployerPaymentProof(
  token: string,
  request: CreateEmployerPaymentProofRequest,
  signal: AbortSignal
): Promise<EmployerPaymentProof> {
  return retryMutation(async (signal) => {
    return apiClient<EmployerPaymentProof>({
      path: "/proofs/employer-payment",
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

function isTrustedPayment(payment: Payment): boolean {
  return payment.isEligible && payment.classification === "INCOME";
}

/**
 * Groups payments within [periodStart, periodEnd] by source address into
 * candidate employer sources. Untrusted (excluded/ineligible) payments
 * are summarized too, but always as UNTRUSTED, so the wizard can
 * explicitly show — and refuse to let the user select — a revoked or
 * ineligible source, rather than silently omitting it.
 */
export function deriveEmployerSources(
  payments: Payment[],
  periodStart: string,
  periodEnd: string
): EmployerSource[] {
  const start = new Date(periodStart).getTime();
  const end = new Date(periodEnd).getTime();

  const withinPeriod = payments.filter((p) => {
    const occurred = new Date(p.occurredAt).getTime();
    return !Number.isNaN(occurred) && occurred >= start && occurred <= end;
  });

  const bySource = new Map<string, Payment[]>();
  for (const payment of withinPeriod) {
    const existing = bySource.get(payment.sourceAddress) ?? [];
    existing.push(payment);
    bySource.set(payment.sourceAddress, existing);
  }

  const sources: EmployerSource[] = [];
  for (const [sourceAddress, sourcePayments] of bySource) {
    const trustedPayments = sourcePayments.filter(isTrustedPayment);
    // A source is only ever TRUSTED when every payment from it in this
    // period is eligible, INCOME-classified. A single excluded/ineligible
    // payment is enough to mark the whole source untrusted for this
    // period — mixing a trusted and an untrusted signal silently in the
    // worker's favor would defeat the point of the trust check.
    const trust: EmployerSourceTrust =
      trustedPayments.length === sourcePayments.length && trustedPayments.length > 0
        ? "TRUSTED"
        : "UNTRUSTED";

    const sortedByDate = [...sourcePayments].sort(
      (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime()
    );

    sources.push({
      sourceAddress,
      trust,
      paymentCount: sourcePayments.length,
      assetCodes: Array.from(new Set(sourcePayments.map((p) => p.assetCode))),
      firstPaymentAt: sortedByDate[0].occurredAt,
      lastPaymentAt: sortedByDate[sortedByDate.length - 1].occurredAt,
    });
  }

  return sources.sort((a, b) => b.lastPaymentAt.localeCompare(a.lastPaymentAt));
}

export type SourceMatchStatus = "NO_MATCH" | "SINGLE_MATCH" | "MULTIPLE_MATCH";

/**
 * Classifies the trusted-source matches for a period so the wizard can
 * explain ambiguous or missing matches to the user, per the issue's
 * acceptance criteria, instead of silently picking one or showing a bare
 * empty list.
 */
export function getSourceMatchStatus(sources: EmployerSource[]): SourceMatchStatus {
  const trusted = sources.filter((s) => s.trust === "TRUSTED");
  if (trusted.length === 0) return "NO_MATCH";
  if (trusted.length === 1) return "SINGLE_MATCH";
  return "MULTIPLE_MATCH";
}

export function truncateSourceAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}

export function validateEmployerPaymentProofRequest(
  request: Partial<CreateEmployerPaymentProofRequest>
): string | null {
  if (!request.sourceAddress?.trim()) {
    return "An employer source must be selected";
  }
  if (!request.periodStart) {
    return "Period start date is required";
  }
  if (!request.periodEnd) {
    return "Period end date is required";
  }
  if (new Date(request.periodStart) >= new Date(request.periodEnd)) {
    return "Period end must be after period start";
  }
  if (!request.assetCode?.trim()) {
    return "Asset code is required";
  }
  if (request.expiresInDays !== undefined) {
    if (request.expiresInDays < 1 || request.expiresInDays > 365) {
      return "Expiry must be between 1 and 365 days";
    }
  }
  return null;
}
