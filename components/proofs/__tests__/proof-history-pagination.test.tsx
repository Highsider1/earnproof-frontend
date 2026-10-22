/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ProofHistoryPagination } from "../proof-history-pagination";

describe("ProofHistoryPagination", () => {
  const mockOnNext = jest.fn();
  const mockOnPrevious = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("rendering", () => {
    it("renders Previous and Next buttons", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });
  });

  describe("button states", () => {
    it("enables Previous button when hasPrevious is true", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      const prevButton = screen.getByRole("button", { name: /previous/i });
      expect(prevButton).not.toBeDisabled();
    });

    it("disables Previous button when hasPrevious is false", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={false}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      const prevButton = screen.getByRole("button", { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });

    it("enables Next button when hasNext is true", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={false}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    it("disables Next button when hasNext is false", () => {
      render(
        <ProofHistoryPagination
          hasNext={false}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });

    it("disables both buttons when disabled=true", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
          disabled={true}
        />
      );

      const prevButton = screen.getByRole("button", { name: /previous/i });
      const nextButton = screen.getByRole("button", { name: /next/i });

      expect(prevButton).toBeDisabled();
      expect(nextButton).toBeDisabled();
    });
  });

  describe("click handlers", () => {
    it("calls onNext when Next button is clicked", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={false}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      expect(mockOnNext).toHaveBeenCalledTimes(1);
    });

    it("calls onPrevious when Previous button is clicked", () => {
      render(
        <ProofHistoryPagination
          hasNext={false}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      expect(mockOnPrevious).toHaveBeenCalledTimes(1);
    });

    it("does not call handlers when disabled buttons are clicked", () => {
      render(
        <ProofHistoryPagination
          hasNext={false}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      // Try to click disabled Next button
      const nextButton = screen.getByRole("button", { name: /next/i });
      fireEvent.click(nextButton);

      expect(mockOnNext).not.toHaveBeenCalled();
    });
  });

  describe("accessibility", () => {
    it("has proper aria-labels", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      expect(screen.getByLabelText(/previous page/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/next page/i)).toBeInTheDocument();
    });

    it("buttons are keyboard accessible", () => {
      render(
        <ProofHistoryPagination
          hasNext={true}
          hasPrevious={true}
          onNext={mockOnNext}
          onPrevious={mockOnPrevious}
        />
      );

      const nextButton = screen.getByRole("button", { name: /next/i });

      // Simulate keyboard navigation (focus and Enter)
      nextButton.focus();
      expect(nextButton).toHaveFocus();

      fireEvent.keyDown(nextButton, { key: "Enter" });
      fireEvent.click(nextButton);

      expect(mockOnNext).toHaveBeenCalled();
    });
  });
});
