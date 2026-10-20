"use client";

import { formatDate } from "@/lib/i18n";
import type { SettlementMatchOutcome } from "@/lib/validation/invoice-settlement-proofs";

export type SettlementCandidate = {
  paymentId: string;
  assetCode: string;
  occurredAt: string;
  isSupportedAsset: boolean;
  alreadyBoundElsewhere: boolean;
};

export function SettlementMatchStep({
  candidates,
  selectedPaymentId,
  matchOutcome,
  onSelectPayment,
}: {
  candidates: SettlementCandidate[];
  selectedPaymentId: string | null;
  matchOutcome: SettlementMatchOutcome;
  onSelectPayment: (paymentId: string) => void;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Settlement Match</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Select the payment that settles this invoice. Only eligible income payments in a
          supported asset are shown; unrelated payments are never displayed here.
        </p>
      </div>

      {matchOutcome.kind === "NO_MATCH" && (
        <div className="rounded-md border border-slate-600 bg-slate-900 p-3">
          <p className="text-sm text-slate-300">No eligible payments are available to match yet.</p>
        </div>
      )}

      {matchOutcome.kind === "UNSUPPORTED_ASSET" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-200" role="alert">
            The available payment uses {matchOutcome.assetCode}, which is not a supported settlement asset.
          </p>
        </div>
      )}

      {matchOutcome.kind === "ALREADY_BOUND_ELSEWHERE" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-200" role="alert">
            The available payment is already bound to a different invoice reference.
          </p>
        </div>
      )}

      {matchOutcome.kind === "AMBIGUOUS" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-200" role="alert">
            {matchOutcome.candidateCount} payments could match this reference. Select the correct one below.
          </p>
        </div>
      )}

      {matchOutcome.kind === "MATCHED" && (
        <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
          <p className="text-sm text-emerald-200">A single matching settlement was found and selected below.</p>
        </div>
      )}

      <ul className="grid gap-2" aria-label="Candidate settlements">
        {candidates.map((candidate) => (
          <li key={candidate.paymentId}>
            <label
              className={`flex items-center justify-between gap-3 rounded-md border p-3 text-sm cursor-pointer ${
                selectedPaymentId === candidate.paymentId
                  ? "border-cyan-300/50 bg-cyan-300/5"
                  : "border-white/10 bg-slate-950"
              } ${!candidate.isSupportedAsset || candidate.alreadyBoundElsewhere ? "opacity-50" : ""}`}
            >
              <span className="flex items-center gap-3">
                <input
                  type="radio"
                  name="settlement-candidate"
                  checked={selectedPaymentId === candidate.paymentId}
                  onChange={() => onSelectPayment(candidate.paymentId)}
                  disabled={!candidate.isSupportedAsset || candidate.alreadyBoundElsewhere}
                  className="h-4 w-4"
                />
                <span className="text-white">
                  {candidate.assetCode} &middot; {formatDate(new Date(candidate.occurredAt))}
                </span>
              </span>
              {candidate.alreadyBoundElsewhere && (
                <span className="text-xs text-amber-200">Already bound</span>
              )}
              {!candidate.isSupportedAsset && (
                <span className="text-xs text-amber-200">Unsupported asset</span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
