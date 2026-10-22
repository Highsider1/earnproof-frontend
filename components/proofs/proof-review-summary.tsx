"use client";

import type { MinimumIncomeProofPayload } from "@/lib/proofs/minimum-income-payload";

interface ProofReviewSummaryProps {
  payload: MinimumIncomeProofPayload;
  qualifyingPaymentCount: number;
  isConfirmed: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
}

/**
 * Final review before submitting a minimum-income proof. Renders exactly
 * the frozen payload passed in — never live form state — so what the user
 * sees here is byte-equivalent to what gets sent. Distinguishes three
 * kinds of values per the issue's acceptance criteria: committed (sent to
 * the server as-is), derived (server-computed/display-only, never part of
 * the request body), and excluded-private (explicitly never sent).
 */
export function ProofReviewSummary({
  payload,
  qualifyingPaymentCount,
  isConfirmed,
  onConfirm,
  onCancel,
  isSubmitting = false,
}: ProofReviewSummaryProps) {
  return (
    <div className="rounded-lg border border-cyan-300/50 bg-cyan-300/5 p-4">
      <h3 className="text-lg font-semibold text-white">Review before submitting</h3>
      <p className="mt-1 text-sm text-slate-300">
        This is exactly what will be sent. Review carefully — any change to the form above
        will require reviewing again.
      </p>

      <div className="mt-4 grid gap-4">
        <div>
          <h4 className="text-xs font-semibold uppercase text-emerald-300">
            Committed to the proof
          </h4>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Threshold amount</dt>
              <dd className="text-slate-200">
                {payload.thresholdAmount} {payload.assetCode}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Period start</dt>
              <dd className="text-slate-200">{payload.periodStart}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Period end</dt>
              <dd className="text-slate-200">{payload.periodEnd}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Selected payments</dt>
              <dd className="text-slate-200">{payload.selectedPaymentIds.length}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Expires in</dt>
              <dd className="text-slate-200">{payload.expiresInDays} days</dd>
            </div>
          </dl>
        </div>

        <div>
          <h4 className="text-xs font-semibold uppercase text-slate-400">
            Derived (not sent — computed by the server)
          </h4>
          <dl className="mt-2 grid gap-1 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Qualifying payment count</dt>
              <dd className="text-slate-300">{qualifyingPaymentCount}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-md border border-white/10 bg-slate-950 p-3">
          <h4 className="text-xs font-semibold uppercase text-emerald-300">
            Never included
          </h4>
          <p className="mt-1 text-xs text-slate-400">
            Individual payment source addresses and raw transaction data are never part of
            this proof&apos;s payload.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {!isConfirmed ? (
          <button
            className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950"
            onClick={onConfirm}
            type="button"
          >
            I have reviewed this and confirm
          </button>
        ) : (
          <button
            className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
            type="submit"
            disabled={isSubmitting}
          >
            {isSubmitting ? "Creating proof..." : "Create proof"}
          </button>
        )}
        <button
          className="h-9 rounded-md border border-white/15 px-4 text-xs font-semibold text-white"
          onClick={onCancel}
          type="button"
          disabled={isSubmitting}
        >
          Back to edit
        </button>
      </div>
    </div>
  );
}
