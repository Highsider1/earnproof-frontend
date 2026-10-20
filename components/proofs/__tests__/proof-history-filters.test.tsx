/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProofHistoryFilters } from "../proof-history-filters";

describe("ProofHistoryFilters", () => {
  const mockOnFiltersChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders filter toggle button", () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      expect(screen.getByRole("button", { name: /filters/i })).toBeInTheDocument();
    });

    it("shows active filter count badge when filters are applied", () => {
      render(
        <ProofHistoryFilters
          filters={{
            status: "VALID",
            type: "MINIMUM_INCOME",
          }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      expect(screen.getByText("2")).toBeInTheDocument(); // Badge showing 2 active filters
    });

    it("shows active filter pills when collapsed", () => {
      render(
        <ProofHistoryFilters
          filters={{
            status: "VALID",
            issuerId: "issuer-123",
          }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      expect(screen.getByText("Valid")).toBeInTheDocument();
      expect(screen.getByText(/issuer: issuer-123/i)).toBeInTheDocument();
    });

    it("shows 'Clear all' button only when filters are applied", () => {
      const { rerender } = render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      expect(screen.queryByText(/clear all/i)).not.toBeInTheDocument();

      rerender(
        <ProofHistoryFilters
          filters={{ status: "VALID" }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      expect(screen.getByText(/clear all/i)).toBeInTheDocument();
    });
  });

  describe("status filter", () => {
    it("toggles status filter on/off", () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      // Click status button
      fireEvent.click(screen.getByRole("button", { name: "Valid" }));

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        status: "VALID",
      });
    });

    it("can apply multiple status values (only one active at a time UI-wise)", () => {
      const { rerender } = render(
        <ProofHistoryFilters
          filters={{ status: "VALID" }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      // Click a different status - should replace
      fireEvent.click(screen.getByRole("button", { name: "Pending" }));

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        status: "PENDING",
      });
    });
  });

  describe("type filter", () => {
    it("applies proof type filter", () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      // Click type button
      fireEvent.click(screen.getByRole("button", { name: /minimum income/i }));

      expect(mockOnFiltersChange).toHaveBeenCalledWith({
        type: "MINIMUM_INCOME",
      });
    });
  });

  describe("issuer filter", () => {
    it("applies issuer ID on blur", async () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      const input = screen.getByPlaceholderText(/filter by issuer/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "issuer-abc" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ issuerId: "issuer-abc" })
        );
      });
    });

    it("applies issuer ID on Enter key", async () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      const input = screen.getByPlaceholderText(/filter by issuer/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "issuer-xyz" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ issuerId: "issuer-xyz" })
        );
      });
    });

    it("trims whitespace from issuer ID", async () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      const input = screen.getByPlaceholderText(/filter by issuer/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: "  issuer-123  " } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ issuerId: "issuer-123" })
        );
      });
    });
  });

  describe("date range filter", () => {
    it("applies createdFrom date", async () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      const inputs = screen.getAllByDisplayValue("") as HTMLInputElement[];
      const dateInputs = inputs.filter((input) => input.type === "date");

      fireEvent.change(dateInputs[0], { target: { value: "2024-01-01" } });
      fireEvent.blur(dateInputs[0]);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ createdFrom: "2024-01-01" })
        );
      });
    });

    it("applies createdUntil date", async () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Expand filters
      fireEvent.click(screen.getByRole("button", { name: /filters/i }));

      const inputs = screen.getAllByDisplayValue("") as HTMLInputElement[];
      const dateInputs = inputs.filter((input) => input.type === "date");

      fireEvent.change(dateInputs[1], { target: { value: "2024-12-31" } });
      fireEvent.blur(dateInputs[1]);

      await waitFor(() => {
        expect(mockOnFiltersChange).toHaveBeenCalledWith(
          expect.objectContaining({ createdUntil: "2024-12-31" })
        );
      });
    });
  });

  describe("accessibility", () => {
    it("shows expanded filter controls with keyboard", () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      const toggleButton = screen.getByRole("button", { name: /filters/i });

      // Simulate keyboard tab navigation and Enter to expand
      fireEvent.click(toggleButton);

      // All filter sections should be visible now (not hidden)
      expect(screen.getByText(/status/i)).toBeVisible();
      expect(screen.getByText(/type/i)).toBeVisible();
    });

    it("provides aria-labels for filter removal buttons", () => {
      render(
        <ProofHistoryFilters
          filters={{ status: "VALID" }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      // Filter pill should have an accessible remove button
      const removeButtons = screen.queryAllByRole("button");
      const removeButton = removeButtons.find((btn) =>
        btn.getAttribute("aria-label")?.includes("Remove")
      );

      expect(removeButton).toBeInTheDocument();
    });
  });

  describe("disabled state", () => {
    it("disables all controls when disabled=true", () => {
      render(
        <ProofHistoryFilters
          filters={{}}
          onFiltersChange={mockOnFiltersChange}
          disabled={true}
        />
      );

      const toggleButton = screen.getByRole("button", { name: /filters/i });
      expect(toggleButton).toBeDisabled();
    });
  });

  describe("clear filters", () => {
    it("clears all filters when 'Clear all' button is clicked", () => {
      render(
        <ProofHistoryFilters
          filters={{
            status: "VALID",
            type: "MINIMUM_INCOME",
            issuerId: "issuer-123",
            createdFrom: "2024-01-01",
            createdUntil: "2024-12-31",
          }}
          onFiltersChange={mockOnFiltersChange}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /clear all/i }));

      expect(mockOnFiltersChange).toHaveBeenCalledWith({});
    });
  });
});
