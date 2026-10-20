"use client";

import { useState, type ReactNode } from "react";

export type SortDirection = "ascending" | "descending";

interface DataTableProps {
  caption: string;
  children: ReactNode;
}

/**
 * Wraps a semantic <table> for horizontal scrolling on narrow viewports.
 * `data-allow-horizontal-scroll` is the repo's sanctioned opt-in for
 * genuinely wide data tables (see e2e/accessibility/fixtures/display-modes.ts).
 */
export function DataTable({ caption, children }: DataTableProps) {
  return (
    <div className="overflow-x-auto" data-allow-horizontal-scroll>
      <table className="w-full min-w-[640px] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function DataTableHead({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-white/10 text-xs font-semibold uppercase text-slate-400">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return <tbody className="divide-y divide-white/10">{children}</tbody>;
}

interface DataTableHeadCellProps {
  children: ReactNode;
  sortDirection?: SortDirection;
  onSort?: () => void;
  className?: string;
}

/**
 * A column header. When `onSort` is provided, the header becomes a button
 * announcing its current sort state via aria-sort on the <th> itself, which
 * is the correct semantic location for that attribute (not on the button).
 */
export function DataTableHeadCell({
  children,
  sortDirection,
  onSort,
  className = "",
}: DataTableHeadCellProps) {
  const ariaSort = onSort ? sortDirection ?? "none" : undefined;

  return (
    <th scope="col" className={`px-4 py-2 ${className}`} aria-sort={ariaSort}>
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          className="flex items-center gap-1 text-left uppercase tracking-wide text-slate-400 hover:text-slate-200"
        >
          {children}
          <SortIndicator direction={sortDirection} />
        </button>
      ) : (
        children
      )}
    </th>
  );
}

function SortIndicator({ direction }: { direction?: SortDirection }) {
  if (!direction) {
    return <span aria-hidden="true">↕</span>;
  }
  return (
    <span aria-hidden="true">{direction === "ascending" ? "↑" : "↓"}</span>
  );
}

export function DataTableRow({ children }: { children: ReactNode }) {
  return <tr className="text-sm">{children}</tr>;
}

export function DataTableCell({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3 align-top ${className}`}>{children}</td>;
}

export function DataTableEmptyState({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}) {
  return (
    <tbody>
      <tr>
        <td colSpan={colSpan} className="p-4 text-center text-sm text-slate-400">
          {children}
        </td>
      </tr>
    </tbody>
  );
}

interface DataTablePaginationProps {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
}

export function DataTablePagination({
  page,
  pageCount,
  onPageChange,
}: DataTablePaginationProps) {
  if (pageCount <= 1) return null;

  return (
    <nav
      aria-label="Pagination"
      className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-400"
    >
      <span aria-live="polite">
        Page {page} of {pageCount}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50 transition"
        >
          Next
        </button>
      </div>
    </nav>
  );
}

/**
 * Manages controlled sort state (key + direction) and client-side pagination
 * over an already-fetched array, following this app's pattern of lifting
 * mutable state out of dumb list components. The primitives above stay
 * stateless; this hook is the "controlled sorting/selection contract" the
 * table primitives are built around.
 */
export function useDataTableState<T>(
  items: T[],
  options: {
    pageSize?: number;
    getSortValue?: (item: T, sortKey: string) => string;
  } = {}
) {
  const pageSize = options.pageSize ?? 10;
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("ascending");
  const [page, setPage] = useState(1);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDirection("ascending");
    } else {
      setSortDirection((prev) => (prev === "ascending" ? "descending" : "ascending"));
    }
    setPage(1);
  };

  const sortedItems =
    sortKey && options.getSortValue
      ? [...items].sort((a, b) => {
          const comparison = options
            .getSortValue!(a, sortKey)
            .localeCompare(options.getSortValue!(b, sortKey));
          return sortDirection === "ascending" ? comparison : -comparison;
        })
      : items;

  const pageCount = Math.max(1, Math.ceil(sortedItems.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageItems = sortedItems.slice(
    (clampedPage - 1) * pageSize,
    clampedPage * pageSize
  );

  return {
    sortKey,
    sortDirection,
    toggleSort,
    page: clampedPage,
    pageCount,
    setPage,
    pageItems,
  };
}
