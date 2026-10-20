import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LifecycleConfirmationDialog } from "../lifecycle-confirmation-dialog";

describe("LifecycleConfirmationDialog", () => {
  const mockOnConfirm = jest.fn();
  const mockOnCancel = jest.fn();
  const orgName = "Test Organization";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("suspend action", () => {
    it("should display suspend title and description", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Suspend Organization")).toBeInTheDocument();
      expect(screen.getByText(/temporarily disable/i)).toBeInTheDocument();
    });

    it("should list suspend impacts", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Members will lose access/i)).toBeInTheDocument();
      expect(screen.getByText(/API access and integrations will be disabled/i)).toBeInTheDocument();
      expect(screen.getByText(/Data will be preserved/i)).toBeInTheDocument();
    });

    it("should use primary button style for suspend", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /suspend organization/i });
      expect(confirmButton).toHaveClass("bg-cyan-300");
    });
  });

  describe("activate action", () => {
    it("should display activate title and description", () => {
      render(
        <LifecycleConfirmationDialog
          action="activate"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Activate Organization")).toBeInTheDocument();
      expect(screen.getByText(/Reactivate this organization/i)).toBeInTheDocument();
    });

    it("should list activate impacts", () => {
      render(
        <LifecycleConfirmationDialog
          action="activate"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/Members will regain access/i)).toBeInTheDocument();
      expect(screen.getByText(/Integrations and API access will be re-enabled/i)).toBeInTheDocument();
    });
  });

  describe("archive action", () => {
    it("should display archive title and description", () => {
      render(
        <LifecycleConfirmationDialog
          action="archive"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Archive Organization")).toBeInTheDocument();
      expect(screen.getByText(/Archive this organization/i)).toBeInTheDocument();
    });

    it("should list archive impacts", () => {
      render(
        <LifecycleConfirmationDialog
          action="archive"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/All members will lose access permanently/i)).toBeInTheDocument();
      expect(screen.getByText(/read-only for administrators/i)).toBeInTheDocument();
      expect(screen.getByText(/Data will be retained indefinitely/i)).toBeInTheDocument();
    });

    it("should use danger button style for archive", () => {
      render(
        <LifecycleConfirmationDialog
          action="archive"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /archive organization/i });
      expect(confirmButton).toHaveClass("bg-rose-600");
    });
  });

  describe("revoke action", () => {
    it("should display revoke title and description", () => {
      render(
        <LifecycleConfirmationDialog
          action="revoke"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText("Revoke Organization")).toBeInTheDocument();
      expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
    });

    it("should list revoke impacts with permanence warning", () => {
      render(
        <LifecycleConfirmationDialog
          action="revoke"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(/All members will immediately lose access/i)).toBeInTheDocument();
      expect(screen.getByText(/API keys will be invalidated/i)).toBeInTheDocument();
      expect(screen.getByText(/This action is permanent and cannot be reversed/i)).toBeInTheDocument();
    });

    it("should use danger button style for revoke", () => {
      render(
        <LifecycleConfirmationDialog
          action="revoke"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /revoke organization/i });
      expect(confirmButton).toHaveClass("bg-rose-600");
    });
  });

  describe("common behavior", () => {
    it("should display organization name in dialog", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByText(orgName)).toBeInTheDocument();
    });

    it("should call onConfirm when confirm button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /suspend organization/i });
      await user.click(confirmButton);

      expect(mockOnConfirm).toHaveBeenCalled();
    });

    it("should call onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should handle escape key to cancel", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      fireEvent.keyDown(document, { key: "Escape" });

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should disable buttons while processing", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isProcessing={true}
        />
      );

      const confirmButton = screen.getByRole("button", { name: /processing/i });
      const cancelButton = screen.getByRole("button", { name: /cancel/i });

      expect(confirmButton).toBeDisabled();
      expect(cancelButton).toBeDisabled();
    });

    it("should show processing text on confirm button", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
          isProcessing={true}
        />
      );

      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    it("should have proper accessibility attributes", () => {
      const { container } = render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const dialog = container.querySelector('[role="dialog"]');
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(dialog).toHaveAttribute("aria-labelledby", "lifecycle-dialog-title");
      expect(dialog).toHaveAttribute("aria-describedby", "lifecycle-dialog-description");
    });

    it("should focus cancel button on mount", () => {
      render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).toHaveFocus();
    });
  });

  describe("dangerous action styling", () => {
    it("should show warning box for dangerous actions", () => {
      const { container: revokeContainer } = render(
        <LifecycleConfirmationDialog
          action="revoke"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const warningBox = revokeContainer.querySelector(".bg-rose-300");
      expect(warningBox).toBeInTheDocument();

      jest.clearAllMocks();

      const { container: suspendContainer } = render(
        <LifecycleConfirmationDialog
          action="suspend"
          organizationName={orgName}
          onConfirm={mockOnConfirm}
          onCancel={mockOnCancel}
        />
      );

      const warningBoxSuspend = suspendContainer.querySelector(".bg-amber-300");
      expect(warningBoxSuspend).toBeInTheDocument();
    });
  });
});
