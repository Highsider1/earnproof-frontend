"use client";

import Link from "next/link";

export type ProofHistoryEmptyProps = {
  hasFilters?: boolean;
};

/**
 * Empty state for proof history list.
 * Shows different messages based on whether filters are applied.
 */
export function ProofHistoryEmpty({ hasFilters = false }: ProofHistoryEmptyProps) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-8 sm:p-12 text-center">
      <svg
        className="mx-auto h-12 w-12 text-slate-400 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>

      <h3 className="text-lg font-semibold text-white">
        {hasFilters ? "No proofs match your filters" : "No proofs yet"}
      </h3>

      <p className="mt-2 text-sm text-slate-400 max-w-sm mx-auto">
        {hasFilters
          ? "Try adjusting your filters or clearing them to see more results."
          : "You haven't created any proofs yet. Start by creating your first proof."}
      </p>

      {!hasFilters && (
        <Link
          href="/proofs"
          className="mt-6 inline-flex items-center justify-center rounded-lg border border-cyan-300/50 bg-cyan-300 px-6 py-2.5 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
        >
          Create a Proof
        </Link>
      )}
    </div>
  );
}
