/**
 * Hook for managing proof history URL state and filters.
 * 
 * Responsibilities:
 * 1. Parse and validate URL query parameters on mount and URL change
 * 2. Persist filter + cursor state to URL (source of truth)
 * 3. Reset stale cursors to safe defaults while preserving valid filters
 * 4. Provide typed, validated state for components
 * 
 * URL Schema:
 * - ?status=VALID: Filter by status (PENDING|VALID|EXPIRED|REVOKED)
 * - ?type=MINIMUM_INCOME: Filter by type (MINIMUM_INCOME|PAYMENT_RECEIPT|RECURRING_INCOME)
 * - ?issuerId=abc123: Filter by issuer ID
 * - ?createdFrom=2024-01-01: Filter by creation date start (ISO date)
 * - ?createdUntil=2024-12-31: Filter by creation date end (ISO date)
 * - ?cursor=abc123xyz: Pagination cursor
 * - ?limit=20: Page size (1-100, default 20)
 * 
 * Invalid/stale parameters:
 * - Unknown status/type/issuer values are silently dropped
 * - Malformed dates are silently dropped
 * - Stale cursor resets to undefined (triggers load from first page)
 * - Valid filters are always preserved even if cursor is stale
 */

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ListProofsParams, ProofStatus, ProofType } from "@/lib/api/proofs-list";
import { validateListProofsParams } from "@/lib/api/proofs-list";

export type ProofHistoryFilters = {
  status?: ProofStatus;
  type?: ProofType;
  issuerId?: string;
  createdFrom?: string;
  createdUntil?: string;
};

export type ProofHistoryState = {
  filters: ProofHistoryFilters;
  cursor?: string;
  limit: number;
};

export type ProofHistoryStateActions = {
  /** Update filters and reset cursor to undefined (triggers first page load) */
  setFilters: (filters: ProofHistoryFilters) => void;
  /** Update a single filter and reset cursor */
  setFilter: (key: keyof ProofHistoryFilters, value: string | undefined) => void;
  /** Clear all filters but keep cursor (for manual reset button) */
  clearFilters: () => void;
  /** Move to next page using cursor */
  goToNextPage: (nextCursor: string) => void;
  /** Move to previous page using cursor */
  goToPreviousPage: (previousCursor: string) => void;
  /** Reset cursor to undefined without changing filters (for reload) */
  resetCursor: () => void;
  /** Update page size */
  setLimit: (limit: number) => void;
};

/**
 * Hook to manage proof history list state, filters, and pagination via URL.
 * 
 * URL is the source of truth: all state changes are persisted to query parameters.
 * Browser back/forward automatically restore prior state via Next.js useSearchParams.
 * Stale cursors are reset transparently while preserving other filters.
 * 
 * @example
 * const { state, actions } = useProofHistoryState();
 * 
 * // Apply a filter (resets cursor to first page)
 * actions.setFilter("status", "VALID");
 * 
 * // Move to next page
 * actions.goToNextPage(response.pagination.nextCursor);
 * 
 * // Clear all filters but keep pagination
 * actions.clearFilters();
 */
export function useProofHistoryState() {
  const searchParams = useSearchParams();
  const [hydratedState, setHydratedState] = useState<ProofHistoryState | null>(null);

  // Parse URL on mount and whenever searchParams changes
  useEffect(() => {
    const rawParams = Object.fromEntries(searchParams.entries());
    const validated = validateListProofsParams(rawParams);

    const state: ProofHistoryState = {
      filters: {
        status: validated.status,
        type: validated.type,
        issuerId: validated.issuerId,
        createdFrom: validated.createdFrom,
        createdUntil: validated.createdUntil,
      },
      cursor: validated.cursor,
      limit: validated.limit ?? 20,
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydratedState(state);
  }, [searchParams]);

  /**
   * Build updated query string from state, updating only the changed params
   */
  const updateSearchParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Use window.history to avoid navigation
      const newUrl = `${window.location.pathname}?${params}`;
      window.history.replaceState(null, "", newUrl);
    },
    [searchParams]
  );

  const actions: ProofHistoryStateActions = useMemo(() => ({
    setFilters: (filters: ProofHistoryFilters) => {
      const updates: Record<string, string | null> = {
        status: filters.status || null,
        type: filters.type || null,
        issuerId: filters.issuerId || null,
        createdFrom: filters.createdFrom || null,
        createdUntil: filters.createdUntil || null,
        cursor: null, // Reset cursor when filters change
      };
      updateSearchParams(updates);
    },

    setFilter: (key: keyof ProofHistoryFilters, value: string | undefined) => {
      const updates: Record<string, string | null> = {
        [key]: value || null,
        cursor: null, // Reset cursor when any filter changes
      };
      updateSearchParams(updates);
    },

    clearFilters: () => {
      const updates: Record<string, string | null> = {
        status: null,
        type: null,
        issuerId: null,
        createdFrom: null,
        createdUntil: null,
        cursor: null,
      };
      updateSearchParams(updates);
    },

    goToNextPage: (nextCursor: string) => {
      updateSearchParams({ cursor: nextCursor });
    },

    goToPreviousPage: (previousCursor: string) => {
      updateSearchParams({ cursor: previousCursor });
    },

    resetCursor: () => {
      updateSearchParams({ cursor: null });
    },

    setLimit: (limit: number) => {
      const limitStr = limit > 0 && limit <= 100 ? String(limit) : null;
      updateSearchParams({ limit: limitStr });
    },
  }), [updateSearchParams]);

  return {
    state: hydratedState,
    actions,
  };
}

/**
 * Convert URL state to API parameters.
 * Handles the cursor reset scenario: if cursor becomes invalid,
 * this function returns params without cursor, which causes a first-page load.
 * Filters are always preserved.
 * 
 * @param state Proof history state from URL
 * @param isValidCursor Optional callback to validate cursor before use
 * @returns API parameters ready to pass to listProofs()
 */
export function stateToApiParams(
  state: ProofHistoryState,
  isValidCursor?: (cursor: string) => boolean
): ListProofsParams {
  const params: ListProofsParams = {
    status: state.filters.status,
    type: state.filters.type,
    issuerId: state.filters.issuerId,
    createdFrom: state.filters.createdFrom,
    createdUntil: state.filters.createdUntil,
    limit: state.limit,
  };

  // Only include cursor if it's valid
  if (state.cursor && (!isValidCursor || isValidCursor(state.cursor))) {
    params.cursor = state.cursor;
  }

  return params;
}

/**
 * Check if a cursor is likely stale or invalid.
 * This is a heuristic check; the API will ultimately validate.
 * 
 * @param cursor Cursor string to check
 * @param lastFetchedAt Timestamp of last successful API call with this cursor
 * @returns true if cursor appears stale (e.g., > 1 hour old)
 */
export function isCursorStale(cursor: string | undefined, lastFetchedAt: number | undefined): boolean {
  if (!cursor || !lastFetchedAt) {
    return false;
  }

  const CURSOR_VALIDITY_MS = 1 * 60 * 60 * 1000; // 1 hour
  return Date.now() - lastFetchedAt > CURSOR_VALIDITY_MS;
}
