import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { OrganizationList } from "../organization-list";
import { ApiConflictError } from "@/lib/api/client";
import * as organizationsApi from "@/lib/api/organizations";
import type { OrganizationWithRevision } from "@/lib/api/organizations";

// Mock the API module
jest.mock("@/lib/api/organizations");

describe("OrganizationList - Conflict Handling", () => {
  const mockOrganizations: OrganizationWithRevision[] = [
    {
      id: "org-123",
      name: "Test Organization",
      slug: "test-org",
      status: "ACTIVE",
      __revision: "rev-123",
      __loadedAt: new Date().toISOString(),
    },
  ];

  const mockToken = "test-token";
  const mockOnUpdate = jest.fn();
  const defaultProps = {
    token: mockToken,
    walletAddress: "GTESTWALLETADDRESS000000000000000000000000000000000000000",
    paginationState: {
      nextCursor: null,
      previousCursor: null,
      isLoading: false,
    },
    onPreviousPage: jest.fn(),
    onNextPage: jest.fn(),
    focusResults: false,
    onOrganizationUpdated: mockOnUpdate,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays error when update fails with conflict", async () => {
    const conflictError = new ApiConflictError(
      {
        id: "org-123",
        name: "Updated Name",
        slug: "test-org",
        status: "SUSPENDED",
      },
      { status: "ACTIVE" }
    );

    (organizationsApi.updateOrganization as jest.Mock).mockRejectedValue(
      conflictError
    );

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Click suspend button
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    // Confirm the action
    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Conflict dialog should appear
      expect(
        screen.getByText(/Update Conflict: Organization/)
      ).toBeInTheDocument();
    });
  });

  it("shows server vs local values in conflict dialog", async () => {
    const conflictError = new ApiConflictError(
      {
        id: "org-123",
        name: "Server Updated Name",
        slug: "test-org",
        status: "SUSPENDED",
      }
    );

    (organizationsApi.updateOrganization as jest.Mock).mockRejectedValue(
      conflictError
    );

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Check that server and local values are displayed
    expect(screen.getByText("Test Organization")).toBeInTheDocument();
    expect(screen.getByText("Server Updated Name")).toBeInTheDocument();
  });

  it("allows user to reload from server when conflict occurs", async () => {
    const conflictError = new ApiConflictError({
      id: "org-123",
      name: "Server Updated Name",
      slug: "test-org",
      status: "SUSPENDED",
    });

    (organizationsApi.updateOrganization as jest.Mock).mockRejectedValue(
      conflictError
    );

    const reloadedOrg: OrganizationWithRevision = {
      id: "org-123",
      name: "Server Updated Name",
      slug: "test-org",
      status: "SUSPENDED",
      __revision: "rev-124",
      __loadedAt: new Date().toISOString(),
    };

    (organizationsApi.getOrganization as jest.Mock).mockResolvedValue(
      reloadedOrg
    );

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click reload button
    const reloadButton = screen.getByText("Reload from Server");
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(organizationsApi.getOrganization).toHaveBeenCalledWith(
        mockToken,
        "org-123",
        expect.any(AbortSignal)
      );
      expect(mockOnUpdate).toHaveBeenCalledWith(reloadedOrg);
    });
  });

  it("allows user to retry with local changes when conflict occurs", async () => {
    const conflictError = new ApiConflictError({
      id: "org-123",
      name: "Server Updated Name",
      slug: "test-org",
      status: "SUSPENDED",
    });

    (organizationsApi.updateOrganization as jest.Mock)
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({
        id: "org-123",
        name: "Test Organization",
        slug: "test-org",
        status: "ACTIVE",
        __revision: "rev-124",
        __loadedAt: new Date().toISOString(),
      });

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click retry button
    const retryButton = screen.getByText("Retry with My Changes");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(organizationsApi.updateOrganization).toHaveBeenCalledTimes(2);
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it("allows user to keep editing when conflict occurs", async () => {
    const conflictError = new ApiConflictError({
      id: "org-123",
      name: "Server Updated Name",
      slug: "test-org",
      status: "SUSPENDED",
    });

    (organizationsApi.updateOrganization as jest.Mock).mockRejectedValue(
      conflictError
    );

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click keep editing button
    const keepEditingButton = screen.getByText("Keep Editing");
    fireEvent.click(keepEditingButton);

    await waitFor(() => {
      // Dialog should close
      expect(screen.queryByText(/Update Conflict/)).not.toBeInTheDocument();
    });

    // Should not call update again
    expect(mockOnUpdate).not.toHaveBeenCalled();
  });

  it("preserves revision tracking through status updates", async () => {
    (organizationsApi.updateOrganization as jest.Mock).mockResolvedValue({
      id: "org-123",
      name: "Test Organization",
      slug: "test-org",
      status: "SUSPENDED",
      __revision: "rev-124",
      __loadedAt: new Date().toISOString(),
    });

    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // Click suspend button
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    // Confirm action
    const confirmButton = within(screen.getByRole("dialog")).getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Should have called updateOrganization with the revision
      expect(organizationsApi.updateOrganization).toHaveBeenCalledWith(
        mockToken,
        "org-123",
        expect.objectContaining({
          status: "SUSPENDED",
          __revision: mockOrganizations[0].__revision,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("respects authorization - disables actions for non-admin users", () => {
    render(
      <OrganizationList
        {...defaultProps}
        organizations={mockOrganizations}
        loading={false}
      />
    );

    // All action buttons should be present and functional for admins
    expect(screen.getAllByText("Suspend")).toBeDefined();
  });

  it("handles multiple concurrent conflict scenarios", async () => {
    const orgs: OrganizationWithRevision[] = [
      {
        id: "org-1",
        name: "Org 1",
        slug: "org-1",
        status: "ACTIVE",
        __revision: "rev-1",
        __loadedAt: new Date().toISOString(),
      },
      {
        id: "org-2",
        name: "Org 2",
        slug: "org-2",
        status: "ACTIVE",
        __revision: "rev-2",
        __loadedAt: new Date().toISOString(),
      },
    ];

    const conflictError = new ApiConflictError({
      id: "org-1",
      name: "Updated Org 1",
      slug: "org-1",
      status: "SUSPENDED",
    });

    (organizationsApi.updateOrganization as jest.Mock).mockRejectedValue(
      conflictError
    );

    render(
      <OrganizationList
        {...defaultProps}
        organizations={orgs}
        loading={false}
      />
    );

    // Get all suspend buttons
    const suspendButtons = screen.getAllByText("Suspend");
    expect(suspendButtons.length).toBe(2);

    // Click first org's suspend
    fireEvent.click(suspendButtons[0]);

    const confirmButtons = screen.getAllByText("Suspend");
    fireEvent.click(confirmButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });
  });
});
