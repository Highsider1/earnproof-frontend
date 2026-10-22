import { apiClient, bearer, retryRead, retryMutation } from "./client";

/**
 * PROCESSING: currently in flight; retry/reconcile must be disabled while a
 * given operation is in this state (see issue #167's "prevent retries while
 * an operation is already processing").
 * FAILED_TRANSIENT: a retryable failure (network blip, RPC timeout, a
 * temporarily unavailable ledger) — safe to retry as-is.
 * FAILED_PERMANENT: a non-retryable failure (e.g. the underlying proof was
 * revoked, or the payload was rejected by the ledger) — retrying the same
 * operation will fail again; reconciliation (re-deriving the operation from
 * current proof state) is the only path forward.
 * ANCHORED: succeeded; no action available.
 */
export type AnchoringStatus = "PROCESSING" | "ANCHORED" | "FAILED_TRANSIENT" | "FAILED_PERMANENT";

export type AnchoringOperation = {
  id: string;
  proofId: string;
  status: AnchoringStatus;
  attemptCount: number;
  lastAttemptedAt: string | null;
  anchoredAt: string | null;
  failureReason: string | null;
  createdAt: string;
};

export function isRetryEligible(operation: AnchoringOperation): boolean {
  return operation.status === "FAILED_TRANSIENT";
}

export function isReconcileEligible(operation: AnchoringOperation): boolean {
  return operation.status === "FAILED_PERMANENT";
}

export async function getAnchoringOperations(token: string, signal: AbortSignal): Promise<AnchoringOperation[]> {
  return retryRead(async (signal) => {
    return apiClient<AnchoringOperation[]>({
      path: "/anchoring/operations",
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export async function retryAnchoringOperation(
  token: string,
  operationId: string,
  signal: AbortSignal
): Promise<AnchoringOperation> {
  return retryMutation(async (signal) => {
    return apiClient<AnchoringOperation>({
      path: `/anchoring/operations/${operationId}/retry`,
      method: "POST",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export async function reconcileAnchoringOperation(
  token: string,
  operationId: string,
  signal: AbortSignal
): Promise<AnchoringOperation> {
  return retryMutation(async (signal) => {
    return apiClient<AnchoringOperation>({
      path: `/anchoring/operations/${operationId}/reconcile`,
      method: "POST",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export function formatAnchoringStatus(status: AnchoringStatus): string {
  switch (status) {
    case "PROCESSING":
      return "Processing";
    case "ANCHORED":
      return "Anchored";
    case "FAILED_TRANSIENT":
      return "Failed (retryable)";
    case "FAILED_PERMANENT":
      return "Failed (permanent)";
  }
}
