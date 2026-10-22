"use client";

import { useCallback, useState } from "react";
import { AnchoringStatusBadge } from "./anchoring-status-badge";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { retryAnchoringOperation, reconcileAnchoringOperation, isRetryEligible, isReconcileEligible, type AnchoringOperation } from "@/lib/api/anchoring";
import { formatDateTime, formatMessage } from "@/lib/i18n";

const actionTitles = {
  retry: "Retry Anchoring Operation",
  reconcile: "Reconcile Anchoring Operation",
} as const;

const actionConfirmText = {
  retry: "Retry",
  reconcile: "Reconcile",
} as const;

export function AnchoringOperationList({
  operations,
  loading,
  token,
  onOperationUpdated,
}: {
  operations: AnchoringOperation[];
  loading: boolean;
  token: string;
  onOperationUpdated: (operation: AnchoringOperation) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: "retry" | "reconcile";
    operationId: string;
    proofId: string;
  } | null>(null);

  const handleRetry = useCallback(
    async (operationId: string) => {
      setActionLoading(operationId);
      setError(null);

      try {
        const controller = new AbortController();
        const updated = await retryAnchoringOperation(token, operationId, controller.signal);
        onOperationUpdated(updated);
      } catch {
        setError("Failed to retry the anchoring operation. Please try again.");
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    },
    [token, onOperationUpdated],
  );

  const handleReconcile = useCallback(
    async (operationId: string) => {
      setActionLoading(operationId);
      setError(null);

      try {
        const controller = new AbortController();
        const updated = await reconcileAnchoringOperation(token, operationId, controller.signal);
        onOperationUpdated(updated);
      } catch {
        setError("Failed to reconcile the anchoring operation. Please try again.");
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    },
    [token, onOperationUpdated],
  );

  if (loading && operations.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading anchoring operations...</p>
      </div>
    );
  }

  if (operations.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">No anchoring operations found.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="hidden grid-cols-[1.2fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
          <div>Proof</div>
          <div>Status</div>
          <div>Attempts</div>
          <div>Last attempted</div>
          <div>Actions</div>
        </div>

        {operations.map((operation) => {
          // A processing operation is already in flight - the disabled state
          // below (not just the confirm dialog) prevents a click from ever
          // reaching retryAnchoringOperation/reconcileAnchoringOperation for
          // it, regardless of how many times the row is clicked.
          const isProcessing = operation.status === "PROCESSING";
          const isLoading = actionLoading === operation.id;

          return (
            <div
              className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[1.2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
              key={operation.id}
            >
              <div className="min-w-0">
                <div className="break-all font-mono text-xs text-white">{operation.proofId}</div>
              </div>
              <div>
                <AnchoringStatusBadge status={operation.status} />
                {operation.failureReason ? (
                  <p className="mt-1 text-xs text-slate-400">{operation.failureReason}</p>
                ) : null}
              </div>
              <div className="text-slate-300">{operation.attemptCount}</div>
              <div className="text-slate-400">
                {operation.lastAttemptedAt ? formatDateTime(operation.lastAttemptedAt) : "Never"}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
                  disabled={isProcessing || isLoading || !isRetryEligible(operation)}
                  onClick={() =>
                    setConfirmAction({ type: "retry", operationId: operation.id, proofId: operation.proofId })
                  }
                  type="button"
                >
                  {isLoading ? "..." : "Retry"}
                </button>
                <button
                  className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
                  disabled={isProcessing || isLoading || !isReconcileEligible(operation)}
                  onClick={() =>
                    setConfirmAction({ type: "reconcile", operationId: operation.id, proofId: operation.proofId })
                  }
                  type="button"
                >
                  {isLoading ? "..." : "Reconcile"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {confirmAction && (
        <ConfirmationDialog
          title={actionTitles[confirmAction.type]}
          message={
            confirmAction.type === "retry"
              ? formatMessage('Retry the anchoring operation for proof "{proofId}"?', {
                  proofId: confirmAction.proofId,
                })
              : formatMessage(
                  'Reconcile the anchoring operation for proof "{proofId}"? This re-derives the operation from current proof state.',
                  { proofId: confirmAction.proofId },
                )
          }
          confirmText={actionConfirmText[confirmAction.type]}
          confirmVariant="primary"
          onConfirm={() => {
            if (confirmAction.type === "retry") {
              handleRetry(confirmAction.operationId);
            } else {
              handleReconcile(confirmAction.operationId);
            }
          }}
          onCancel={() => setConfirmAction(null)}
          isProcessing={actionLoading === confirmAction.operationId}
        />
      )}
    </>
  );
}
