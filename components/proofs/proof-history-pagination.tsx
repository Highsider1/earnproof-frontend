"use client";

/**
 * Cursor-based pagination controls for proof history list.
 * Uses next/previous cursor navigation (not offset-based).
 */
export type ProofHistoryPaginationProps = {
  hasNext: boolean;
  hasPrevious: boolean;
  onNext: () => void;
  onPrevious: () => void;
  disabled?: boolean;
};

export function ProofHistoryPagination({
  hasNext,
  hasPrevious,
  onNext,
  onPrevious,
  disabled = false,
}: ProofHistoryPaginationProps) {
  return (
    <div className="flex items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:justify-between sm:p-5">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!hasPrevious || disabled}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Previous page"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        <span className="hidden sm:inline">Previous</span>
      </button>

      <div className="text-sm text-slate-300">
        Navigate using cursor-based pagination
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!hasNext || disabled}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 5l7 7-7 7"
          />
        </svg>
      </button>
    </div>
  );
}
