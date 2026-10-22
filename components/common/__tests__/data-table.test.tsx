/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, renderHook, act } from "@testing-library/react";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyState,
  DataTableHead,
  DataTableHeadCell,
  DataTablePagination,
  DataTableRow,
  useDataTableState,
} from "../data-table";

describe("DataTable primitives", () => {
  it("renders semantic table markup with an accessible caption", () => {
    render(
      <DataTable caption="Widgets">
        <DataTableHead>
          <DataTableHeadCell>Name</DataTableHeadCell>
        </DataTableHead>
        <DataTableBody>
          <DataTableRow>
            <DataTableCell>Widget A</DataTableCell>
          </DataTableRow>
        </DataTableBody>
      </DataTable>
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("Widgets")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /name/i })).toBeInTheDocument();
  });

  it("marks a sortable column header with aria-sort and toggles on click", () => {
    const onSort = jest.fn();
    render(
      <table>
        <thead>
          <tr>
            <DataTableHeadCell sortDirection="ascending" onSort={onSort}>
              Name
            </DataTableHeadCell>
          </tr>
        </thead>
      </table>
    );

    const header = screen.getByRole("columnheader");
    expect(header).toHaveAttribute("aria-sort", "ascending");

    fireEvent.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it("does not set aria-sort on a non-sortable header", () => {
    render(
      <table>
        <thead>
          <tr>
            <DataTableHeadCell>Created</DataTableHeadCell>
          </tr>
        </thead>
      </table>
    );

    expect(screen.getByRole("columnheader")).not.toHaveAttribute("aria-sort");
  });

  it("renders an empty state inside valid table markup", () => {
    render(
      <table>
        <DataTableEmptyState colSpan={3}>Nothing here</DataTableEmptyState>
      </table>
    );

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.getByRole("cell")).toHaveAttribute("colspan", "3");
  });

  it("renders pagination controls and disables edges", () => {
    const onPageChange = jest.fn();
    render(
      <DataTablePagination page={1} pageCount={3} onPageChange={onPageChange} />
    );

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next/i })).not.toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("renders nothing when there is only one page", () => {
    const { container } = render(
      <DataTablePagination page={1} pageCount={1} onPageChange={jest.fn()} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});

describe("useDataTableState", () => {
  const items = [
    { id: "1", name: "Charlie" },
    { id: "2", name: "Alice" },
    { id: "3", name: "Bob" },
  ];

  it("paginates items according to pageSize", () => {
    const { result } = renderHook(() =>
      useDataTableState(items, { pageSize: 2 })
    );

    expect(result.current.pageItems).toHaveLength(2);
    expect(result.current.pageCount).toBe(2);
  });

  it("sorts ascending then descending when the same key is toggled twice", () => {
    const { result } = renderHook(() =>
      useDataTableState(items, { getSortValue: (item) => item.name })
    );

    act(() => result.current.toggleSort("name"));
    expect(result.current.pageItems.map((i) => i.name)).toEqual([
      "Alice",
      "Bob",
      "Charlie",
    ]);

    act(() => result.current.toggleSort("name"));
    expect(result.current.pageItems.map((i) => i.name)).toEqual([
      "Charlie",
      "Bob",
      "Alice",
    ]);
  });

  it("resets to page 1 when sorting changes", () => {
    const { result } = renderHook(() =>
      useDataTableState(items, { pageSize: 1, getSortValue: (item) => item.name })
    );

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.toggleSort("name"));
    expect(result.current.page).toBe(1);
  });
});
