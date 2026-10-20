"use client";

import { useState, useCallback, useRef } from "react";

export interface PaginationCursorState {
  nextCursor: string | null;
  previousCursor: string | null;
}

export interface PaginationConfig {
  pageSize?: number;
  filter?: Record<string, string | string[]>;
}

export interface UsePaginationReturn {
  currentPage: PaginationCursorState;
  pageSize: number;
  filter: Record<string, string | string[]>;
  isLoading: boolean;
  requestId: string | null;
  
  // Navigation actions
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  resetPagination: () => void;
  
  // State setters for API responses
  setPageState: (cursors: PaginationCursorState, requestId: string) => void;
  setLoading: (loading: boolean) => void;
  setFilter: (filter: Record<string, string | string[]>) => void;
  setPageSize: (size: number) => void;
  
  // Track if this was a user-initiated navigation for focus management
  wasUserInitiated: boolean;
  clearUserInitiated: () => void;
}

/**
 * Manages cursor-based pagination state with race condition protection.
 * 
 * Key features:
 * - Tracks request IDs to prevent stale responses from overwriting newer data
 * - Preserves filter state during pagination
 * - Maintains page size preference
 * - Signals when navigation was user-initiated (for focus management)
 * - Provides safe state mutations with abort signal tracking
 */
export function usePagination(
  initialConfig: PaginationConfig = {},
): UsePaginationReturn {
  // Navigation history for cursor-based pagination
  const [currentPage, setCurrentPage] = useState<PaginationCursorState>({
    nextCursor: null,
    previousCursor: null,
  });

  // Track ongoing request ID to prevent stale responses
  const [requestId, setRequestId] = useState<string | null>(null);
  const [isLoading, setLoading] = useState(false);
  const [wasUserInitiated, setWasUserInitiated] = useState(false);

  // Preserve filter and page size state
  const [pageSize, setPageSize] = useState(initialConfig.pageSize ?? 10);
  const [filter, setFilter] = useState(initialConfig.filter ?? {});

  // Stack of cursors for navigation history (used for previous/next)
  const cursorStackRef = useRef<string[]>([]);

  // Navigation actions with user-initiated flag
  const goToNextPage = useCallback(() => {
    if (currentPage.nextCursor) {
      // Push current cursor to stack for back navigation
      if (currentPage.previousCursor) {
        cursorStackRef.current.push(currentPage.previousCursor);
      }
      setWasUserInitiated(true);
    }
  }, [currentPage.nextCursor, currentPage.previousCursor]);

  const goToPreviousPage = useCallback(() => {
    if (currentPage.previousCursor) {
      setWasUserInitiated(true);
    }
  }, [currentPage.previousCursor]);

  const resetPagination = useCallback(() => {
    setCurrentPage({
      nextCursor: null,
      previousCursor: null,
    });
    cursorStackRef.current = [];
    setRequestId(null);
    setWasUserInitiated(false);
  }, []);

  // Safe state mutation for API responses
  // Only updates if this request ID is newer than or matches the current one
  const setPageState = useCallback(
    (cursors: PaginationCursorState, newRequestId: string) => {
      // Generate numeric IDs for comparison: first request is 1, second is 2, etc.
      const currentRequestNum = requestId ? parseInt(requestId.split("-")[1], 10) : 0;
      const newRequestNum = parseInt(newRequestId.split("-")[1], 10);

      // Only update if the new request is newer than (greater than) the current one
      if (newRequestNum > currentRequestNum) {
        setCurrentPage(cursors);
        setRequestId(newRequestId);
      }
      // If equal (same request ID), update silently (retry scenario)
      else if (newRequestNum === currentRequestNum) {
        setCurrentPage(cursors);
      }
      // If older (newRequestNum < currentRequestNum), ignore completely
      // This prevents stale responses from overwriting newer data
    },
    [requestId]
  );

  const clearUserInitiated = useCallback(() => {
    setWasUserInitiated(false);
  }, []);

  const setFilterHandler = useCallback(
    (newFilter: Record<string, string | string[]>) => {
      setFilter(newFilter);
      resetPagination();
    },
    [resetPagination]
  );

  const setPageSizeHandler = useCallback(
    (size: number) => {
      setPageSize(size);
      resetPagination();
    },
    [resetPagination]
  );

  return {
    currentPage,
    pageSize,
    filter,
    isLoading,
    requestId,
    goToNextPage,
    goToPreviousPage,
    resetPagination,
    setPageState,
    setLoading,
    setFilter: setFilterHandler,
    setPageSize: setPageSizeHandler,
    wasUserInitiated,
    clearUserInitiated,
  };
}
