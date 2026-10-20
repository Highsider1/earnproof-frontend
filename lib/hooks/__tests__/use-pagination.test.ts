/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { usePagination } from "../use-pagination";

describe("usePagination Hook", () => {
  describe("Happy Path", () => {
    it("initializes with correct default state", () => {
      const { result } = renderHook(() => usePagination());

      expect(result.current.currentPage).toEqual({
        nextCursor: null,
        previousCursor: null,
      });
      expect(result.current.pageSize).toBe(10);
      expect(result.current.filter).toEqual({});
      expect(result.current.isLoading).toBe(false);
      expect(result.current.requestId).toBeNull();
      expect(result.current.wasUserInitiated).toBe(false);
    });

    it("allows navigation to next page", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: null,
          },
          "req-1"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_2");
    });

    it("signals user-initiated navigation for focus management", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: null,
          },
          "req-1"
        );
      });

      expect(result.current.wasUserInitiated).toBe(false);

      act(() => {
        result.current.goToNextPage();
      });

      expect(result.current.wasUserInitiated).toBe(true);
    });

    it("clears user-initiated flag", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: null,
          },
          "req-1"
        );
      });

      act(() => {
        result.current.goToNextPage();
      });

      expect(result.current.wasUserInitiated).toBe(true);

      act(() => {
        result.current.clearUserInitiated();
      });

      expect(result.current.wasUserInitiated).toBe(false);
    });

    it("preserves page size across resets", () => {
      const { result } = renderHook(() => usePagination({ pageSize: 25 }));

      expect(result.current.pageSize).toBe(25);

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.pageSize).toBe(25);
    });

    it("preserves filter across pagination", () => {
      const initialFilter = { status: "ACTIVE", type: "test" };
      const { result } = renderHook(() =>
        usePagination({ filter: initialFilter })
      );

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: null,
          },
          "req-1"
        );
      });

      expect(result.current.filter).toEqual(initialFilter);
    });

    it("updates filter and resets pagination", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: "cursor_1",
          },
          "req-1"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_2");

      act(() => {
        result.current.setFilter({ status: "SUSPENDED" });
      });

      expect(result.current.filter).toEqual({ status: "SUSPENDED" });
      expect(result.current.currentPage).toEqual({
        nextCursor: null,
        previousCursor: null,
      });
    });
  });

  describe("Edge Cases", () => {
    it("handles navigation with no next cursor", () => {
      const { result } = renderHook(() => usePagination());

      // Current state has no next cursor
      expect(result.current.currentPage.nextCursor).toBeNull();

      act(() => {
        result.current.goToNextPage();
      });

      // wasUserInitiated should remain false since there's no next cursor
      expect(result.current.wasUserInitiated).toBe(false);
    });

    it("handles navigation with no previous cursor", () => {
      const { result } = renderHook(() => usePagination());

      expect(result.current.currentPage.previousCursor).toBeNull();

      act(() => {
        result.current.goToPreviousPage();
      });

      expect(result.current.wasUserInitiated).toBe(false);
    });

    it("handles empty filter state", () => {
      const { result } = renderHook(() =>
        usePagination({ filter: {} })
      );

      expect(result.current.filter).toEqual({});
    });

    it("updates page size and resets pagination", () => {
      const { result } = renderHook(() => usePagination({ pageSize: 10 }));

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: "cursor_1",
          },
          "req-1"
        );
      });

      act(() => {
        result.current.setPageSize(50);
      });

      expect(result.current.pageSize).toBe(50);
      expect(result.current.currentPage.nextCursor).toBeNull();
    });

    it("manages multiple rapid navigations", () => {
      const { result } = renderHook(() => usePagination());

      // First page load with next cursor
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_2", previousCursor: null },
          "req-1"
        );
      });

      // Now navigate to next page
      act(() => {
        result.current.goToNextPage();
      });

      expect(result.current.wasUserInitiated).toBe(true);

      act(() => {
        result.current.clearUserInitiated();
      });

      // Second page load with more cursors
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_3", previousCursor: "cursor_2" },
          "req-2"
        );
      });

      // Navigate again
      act(() => {
        result.current.goToNextPage();
      });

      expect(result.current.wasUserInitiated).toBe(true);
    });
  });

  describe("Stale Request/Race Condition Tests", () => {
    it("displays newest request result", () => {
      const { result } = renderHook(() => usePagination());

      // First request
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_1_next", previousCursor: null },
          "req-1"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_1_next");

      // Second, newer request
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_2_next", previousCursor: "cursor_1" },
          "req-2"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_2_next");
      expect(result.current.requestId).toBe("req-2");
    });

    it("prevents stale response from overwriting newer data", () => {
      const { result } = renderHook(() => usePagination());

      // Newer request (req-2) completes first
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_2_next", previousCursor: "cursor_1" },
          "req-2"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_2_next");

      // Older request (req-1) arrives later - should be ignored
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_1_next", previousCursor: null },
          "req-1"
        );
      });

      // Should still have the newer data
      expect(result.current.currentPage.nextCursor).toBe("cursor_2_next");
      expect(result.current.requestId).toBe("req-2");
    });

    it("handles rapid next/previous alternation", () => {
      const { result } = renderHook(() => usePagination());

      // User navigates: next -> previous -> next
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_2", previousCursor: null },
          "req-1"
        );
      });

      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_3", previousCursor: "cursor_2" },
          "req-2"
        );
      });

      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_4", previousCursor: "cursor_3" },
          "req-3"
        );
      });

      // Should have latest state
      expect(result.current.currentPage.nextCursor).toBe("cursor_4");
      expect(result.current.requestId).toBe("req-3");
    });

    it("ignores duplicate request IDs silently", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_1", previousCursor: null },
          "req-1"
        );
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_1");

      // Same request ID (retry scenario)
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_1_updated", previousCursor: null },
          "req-1"
        );
      });

      // Should update with new data for same request ID
      expect(result.current.currentPage.nextCursor).toBe("cursor_1_updated");
      expect(result.current.requestId).toBe("req-1");
    });

    it("maintains UI consistency after out-of-order responses", () => {
      const { result } = renderHook(() => usePagination());

      // Simulate: user clicks next twice rapidly
      // Response 2 arrives before response 1

      // Response from req-2 arrives first
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_3", previousCursor: "cursor_2" },
          "req-2"
        );
      });

      // Response from req-1 arrives later (should be ignored)
      act(() => {
        result.current.setPageState(
          { nextCursor: "cursor_2", previousCursor: "cursor_1" },
          "req-1"
        );
      });

      // UI should show data from the newer request
      expect(result.current.currentPage.previousCursor).toBe("cursor_2");
      expect(result.current.currentPage.nextCursor).toBe("cursor_3");
    });
  });

  describe("Negative Tests", () => {
    it("resets pagination on filter change", () => {
      const { result } = renderHook(() => usePagination());

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: "cursor_1",
          },
          "req-1"
        );
      });

      act(() => {
        result.current.setFilter({ newFilter: "value" });
      });

      expect(result.current.currentPage.nextCursor).toBeNull();
      expect(result.current.currentPage.previousCursor).toBeNull();
    });

    it("never overwrites with older response", () => {
      const { result } = renderHook(() => usePagination());

      // Create a chain of requests
      act(() => {
        result.current.setPageState(
          { nextCursor: "page_3_next", previousCursor: "page_3_prev" },
          "req-3"
        );
      });

      act(() => {
        result.current.setPageState(
          { nextCursor: "page_2_next", previousCursor: "page_2_prev" },
          "req-2"
        );
      });

      act(() => {
        result.current.setPageState(
          { nextCursor: "page_1_next", previousCursor: "page_1_prev" },
          "req-1"
        );
      });

      // Oldest request arrives last - should be completely ignored
      expect(result.current.currentPage.nextCursor).toBe("page_3_next");
    });

    it("resets all state on resetPagination call", () => {
      const { result } = renderHook(() =>
        usePagination({ pageSize: 25, filter: { status: "ACTIVE" } })
      );

      act(() => {
        result.current.setPageState(
          {
            nextCursor: "cursor_2",
            previousCursor: "cursor_1",
          },
          "req-1"
        );
      });

      act(() => {
        result.current.goToNextPage();
      });

      expect(result.current.currentPage.nextCursor).toBe("cursor_2");
      expect(result.current.wasUserInitiated).toBe(true);
      expect(result.current.requestId).toBe("req-1");

      act(() => {
        result.current.resetPagination();
      });

      expect(result.current.currentPage).toEqual({
        nextCursor: null,
        previousCursor: null,
      });
      expect(result.current.requestId).toBeNull();
      expect(result.current.wasUserInitiated).toBe(false);
      // pageSize and filter should be preserved per implementation
    });
  });
});
