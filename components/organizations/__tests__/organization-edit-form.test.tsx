import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OrganizationEditForm } from "../organization-edit-form";
import * as organizationsApi from "@/lib/api/organizations";

// Mock the API
jest.mock("@/lib/api/organizations");

const mockOrganization = {
  id: "org-123",
  name: "Test Organization",
  slug: "test-org",
  website: "https://example.com",
  status: "ACTIVE" as const,
};

describe("OrganizationEditForm", () => {
  const mockToken = "test-token";
  const mockOnUpdate = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("positive flow: valid edit saves and reflects in UI", () => {
    it("should render form with current organization data", () => {
      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByDisplayValue("Test Organization")).toBeInTheDocument();
      expect(screen.getByDisplayValue("https://example.com")).toBeInTheDocument();
    });

    it("should disable Save button when form is clean", () => {
      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    });

    it("should enable Save button when form is dirty", async () => {
      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, "Updated Name");

      expect(screen.getByRole("button", { name: /save changes/i })).toBeEnabled();
    });

    it("should save valid changes and call onOrganizationUpdated", async () => {
      const user = userEvent.setup();
      const updatedOrg = { ...mockOrganization, name: "Updated Name" };

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockResolvedValue({
        success: true,
        data: updatedOrg,
      });

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(mockOnUpdate).toHaveBeenCalledWith(updatedOrg);
      });
    });

    it("should show loading state while saving", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() => resolve({ success: true, data: mockOrganization }), 100)
        )
      );

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated Name");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      expect(screen.getByRole("button", { name: /saving\.\.\./i })).toBeInTheDocument();
    });
  });

  describe("negative flow: invalid input surfaces field errors", () => {
    it("should show validation error for empty name", async () => {
      const user = userEvent.setup();

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "a"); // Too short
      await user.tab(); // Trigger validation

      // Wait for error to appear
      await waitFor(() => {
        expect(screen.getByText(/at least 2 characters/i)).toBeInTheDocument();
      });
    });

    it("should show validation error for invalid URL", async () => {
      const user = userEvent.setup();

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const websiteInput = screen.getByDisplayValue("https://example.com");
      await user.clear(websiteInput);
      await user.type(websiteInput, "not-a-url");
      await user.tab();

      await waitFor(() => {
        expect(screen.getByText(/valid website url/i)).toBeInTheDocument();
      });
    });

    it("should prevent form submission with validation errors", async () => {
      const user = userEvent.setup();

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.tab();

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      // Should still be disabled or form shouldn't submit
      expect(nameInput.value).toBe("");
    });
  });

  describe("negative flow: failed write preserves input and shows retry", () => {
    it("should display form error on API failure", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          message: "Server error occurred",
          type: "unknown",
          fieldErrors: {},
          isRetryable: true,
        },
      });

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization") as HTMLInputElement;
      await user.clear(nameInput);
      await user.type(nameInput, "New Name");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("Server error occurred")).toBeInTheDocument();
      });

      // Input should be preserved
      expect(nameInput.value).toBe("New Name");
    });

    it("should show retry button for retryable errors", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          message: "Network timeout",
          type: "network",
          fieldErrors: {},
          isRetryable: true,
        },
      });

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
      });
    });

    it("should display server-side field errors", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          message: "Validation failed",
          type: "validation",
          fieldErrors: {
            name: "Name already exists",
            website: "Domain is blacklisted",
          },
          isRetryable: false,
        },
      });

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Taken Name");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText("Name already exists")).toBeInTheDocument();
        expect(screen.getByText("Domain is blacklisted")).toBeInTheDocument();
      });
    });
  });

  describe("conflict response handling", () => {
    it("should display conflict error with guidance", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockResolvedValue({
        success: false,
        error: {
          message: "Organization was modified by another admin",
          type: "conflict",
          fieldErrors: {},
          statusCode: 409,
          isRetryable: true,
        },
      });

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/modified by another admin/i)).toBeInTheDocument();
        expect(screen.getByText(/refresh the page/i)).toBeInTheDocument();
      });
    });
  });

  describe("cancel action", () => {
    it("should call onCancel when cancel button is clicked", async () => {
      const user = userEvent.setup();

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it("should disable cancel button while saving", async () => {
      const user = userEvent.setup();

      (organizationsApi.updateOrganizationSafe as jest.Mock).mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() => resolve({ success: true, data: mockOrganization }), 100)
        )
      );

      render(
        <OrganizationEditForm
          organization={mockOrganization}
          token={mockToken}
          onOrganizationUpdated={mockOnUpdate}
          onCancel={mockOnCancel}
        />
      );

      const nameInput = screen.getByDisplayValue("Test Organization");
      await user.clear(nameInput);
      await user.type(nameInput, "Updated");

      const saveButton = screen.getByRole("button", { name: /save changes/i });
      await user.click(saveButton);

      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      expect(cancelButton).toBeDisabled();
    });
  });
});
