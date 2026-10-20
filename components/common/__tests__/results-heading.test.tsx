/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { ResultsHeading } from "../results-heading";

describe("ResultsHeading", () => {
  describe("Happy Path", () => {
    it("renders heading content correctly", () => {
      render(
        <ResultsHeading>
          API Keys
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveTextContent("API Keys");
    });

    it("renders with tabindex=-1 for programmatic focus", () => {
      render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveAttribute("tabIndex", "-1");
    });

    it("moves focus to heading when onFocusRequested is true", () => {
      const { rerender } = render(
        <ResultsHeading onFocusRequested={false}>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).not.toHaveFocus();

      // Trigger focus request
      rerender(
        <ResultsHeading onFocusRequested={true}>
          Results
        </ResultsHeading>
      );

      expect(heading).toHaveFocus();
    });

    it("renders aria-live announcement region with status role", () => {
      render(
        <ResultsHeading announcement="Results updated">
          Results
        </ResultsHeading>
      );

      const liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
      expect(liveRegion).toHaveAttribute("aria-atomic", "true");
    });

    it("includes announcement text in aria-live region", () => {
      render(
        <ResultsHeading announcement="Showing 25 results">
          Results
        </ResultsHeading>
      );

      const liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveTextContent("Showing 25 results");
    });

    it("has focus styles with ring appearance", () => {
      render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveClass("focus:ring-2");
      expect(heading).toHaveClass("focus:ring-cyan-300");
    });
  });

  describe("Edge Cases", () => {
    it("does not move focus on initial render without onFocusRequested", () => {
      render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).not.toHaveFocus();
    });

    it("does not move focus on unrelated rerenders", () => {
      const { rerender } = render(
        <ResultsHeading onFocusRequested={false}>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      
      // Rerender with different content but same focus flag
      rerender(
        <ResultsHeading onFocusRequested={false}>
          Different Results
        </ResultsHeading>
      );

      expect(heading).not.toHaveFocus();
    });

    it("moves focus on multiple page transitions", () => {
      const { rerender } = render(
        <ResultsHeading onFocusRequested={false}>
          Results - Page 1
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });

      // First focus request
      rerender(
        <ResultsHeading onFocusRequested={true}>
          Results - Page 1
        </ResultsHeading>
      );
      expect(heading).toHaveFocus();

      // Reset focus state
      rerender(
        <ResultsHeading onFocusRequested={false}>
          Results - Page 2
        </ResultsHeading>
      );

      // Second focus request
      rerender(
        <ResultsHeading onFocusRequested={true}>
          Results - Page 2
        </ResultsHeading>
      );
      expect(heading).toHaveFocus();
    });

    it("handles missing announcement gracefully", () => {
      const { container } = render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      // Should not render status region without announcement
      expect(container.querySelector('[role="status"]')).not.toBeInTheDocument();
    });

    it("updates announcement text when changed", () => {
      const { rerender } = render(
        <ResultsHeading announcement="Loading results">
          Results
        </ResultsHeading>
      );

      let liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveTextContent("Loading results");

      rerender(
        <ResultsHeading announcement="Results updated">
          Results
        </ResultsHeading>
      );

      liveRegion = screen.getByRole("status");
      expect(liveRegion).toHaveTextContent("Results updated");
    });
  });

  describe("Regression Tests", () => {
    it("maintains keyboard navigation functionality", () => {
      render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveAttribute("tabIndex", "-1");
      // tabindex=-1 allows programmatic focus but not keyboard Tab
    });

    it("applies no outline on normal state", () => {
      render(
        <ResultsHeading>
          Results
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading).toHaveClass("focus:outline-none");
    });

    it("preserves semantic heading structure", () => {
      render(
        <ResultsHeading>
          Management List
        </ResultsHeading>
      );

      const heading = screen.getByRole("heading", { level: 2 });
      expect(heading.tagName).toBe("H2");
    });
  });
});
