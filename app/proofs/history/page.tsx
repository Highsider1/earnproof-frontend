"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { ProofErrorBoundary } from "@/components/common/proof-error-boundary";
import { useProofHistoryState, stateToApiParams, isCursorStale } from "@/lib/hooks/use-proof-history-state";
import { listProofs, type ProofsListResponse } from "@/lib/api/proofs-list";
import { readStoredSession } from "@/lib/session";
import { ProofHistoryList } from "@/components/proofs/proof-history-list";
import { ProofHistoryFilters } from "@/components/proofs/proof-history-filters";
import { ProofHistoryPagination } from "@/components/proofs/proof-history-pagination";
import { ProofListSkeleton } from "@/components/proofs/proof-list-skeleton";
import { ProofHistoryEmpty } from "@/components/proofs/proof-history-empty";

type ProofsListState = {
  data: ProofsListResponse | null;
  loading: boolean;
  error: Error | null;
  lastFetchedAt: number | null;
};

export default function ProofHistoryPage() {
  const { state, actions } = useProofHistoryState();
  const [listState, setListState] = useState<ProofsListState>({
    data: null,
    loading: false,
    error: null,
    lastFetchedAt: null,
  });
  const [session, setSession] = useState<{ token: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load session on mount
  useEffect(() => {
    try {
      const stored = readStoredSession();
      setSession(stored ? { token: stored.token } : null);
    } catch (error) {
      console.warn("Failed to load session:", error);
      setSession(null);
    }
  }, []);

  // Fetch proofs list when state or session changes
  useEffect(() => {
    if (!session || !state) {
      return;
    }

    // Cancel previous request
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    async function fetchProofs() {
      setListState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const apiParams = stateToApiParams(state, (cursor) => {
          // Check if cursor is stale
          if (isCursorStale(cursor, listState.lastFetchedAt)) {
            // Cursor is stale, reset it in the URL
            actions.resetCursor();
            return false; // Don't use this cursor
          }
          return true;
        });

        const response = await listProofs(
          session.token,
          apiParams,
          abortControllerRef.current!.signal
        );

        setListState((prev) => ({
          ...prev,
          data: response,
          loading: false,
          error: null,
          lastFetchedAt: Date.now(),
        }));
      } catch (error) {
        // Ignore abort errors
        if (error instanceof Error && error.name === "AbortError") {
          return;
        }

        setListState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error : new Error("Failed to load proofs"),
        }));
      }
    }

    fetchProofs();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [session, state, actions, listState.lastFetchedAt]);

  // Handle pagination
  const handleNextPage = (nextCursor: string | null) => {
    if (nextCursor) {
      actions.goToNextPage(nextCursor);
    }
  };

  const handlePreviousPage = (previousCursor: string | null) => {
    if (previousCursor) {
      actions.goToPreviousPage(previousCursor);
    }
  };

  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="View and manage your proof history with filtering and pagination."
          eyebrow="Worker flow"
          title="Proof History"
        />

        <ProofErrorBoundary>
          {/* Filters */}
          {state && (
            <ProofHistoryFilters
              filters={state.filters}
              onFiltersChange={actions.setFilters}
              disabled={listState.loading}
            />
          )}

          {/* List */}
          <div className="space-y-4">
            {listState.loading && !listState.data ? (
              <ProofListSkeleton count={state?.limit ?? 20} />
            ) : listState.error ? (
              <div className="rounded-lg border border-rose-400/20 bg-rose-400/5 p-4 text-sm text-rose-300">
                <p className="font-medium">Failed to load proofs</p>
                <p className="mt-1 text-rose-200">{listState.error.message}</p>
              </div>
            ) : listState.data && listState.data.proofs.length > 0 ? (
              <>
                <ProofHistoryList proofs={listState.data.proofs} />
                {(listState.data.pagination.nextCursor ||
                  listState.data.pagination.previousCursor) && (
                  <ProofHistoryPagination
                    hasNext={listState.data.pagination.hasMore}
                    hasPrevious={!!listState.data.pagination.previousCursor}
                    onNext={() =>
                      handleNextPage(listState.data!.pagination.nextCursor)
                    }
                    onPrevious={() =>
                      handlePreviousPage(
                        listState.data!.pagination.previousCursor
                      )
                    }
                    disabled={listState.loading}
                  />
                )}
              </>
            ) : (
              <ProofHistoryEmpty hasFilters={Object.values(state?.filters ?? {}).some(Boolean)} />
            )}
          </div>
        </ProofErrorBoundary>
      </section>
    </PublicShell>
  );
}
