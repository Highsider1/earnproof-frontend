import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { IssuerList } from "../issuer-list";
import { ApiConflictError } from "@/lib/api/client";
import * as issuersApi from "@/lib/api/issuers";
import type { IssuerWithRevision } from "@/lib/api/issuers";
import type { Organization } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/issuers");

describe("IssuerList - Conflict Handling", () => {
  const mockIssuers: IssuerWithRevision[] = [
    {
      id: "issuer-123",
      name: "Test Issuer",
      status: "ACTIVE",
      organizationId: "org-123",
      __revision: "rev-123",
      __loadedAt: new Date().toISOString(),
    },
  ];

  const mockOrganizations: Organization[] = [
    {
      id: "org-123",
      name: "Test Organization",
      slug: "test-org",
      status: "ACTIVE",
    },
  ];

  const mockToken = "test-token";
  const mockOnUpdate = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays conflict dialog when update fails with 409", async () => {
    const conflictError = new ApiConflictError(
      {
        id: "issuer-123",
        name: "Updated Issuer Name",
        status: "SUSPENDED",
        organizationId: "org-123",
      }
    );

    (issuersApi.updateIssuer as jest.Mock).mockRejectedValue(conflictError);

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict: Issuer/)).toBeInTheDocument();
    });
  });

  it("shows conflicting issuer fields in dialog", async () => {
    const conflictError = new ApiConflictError({
      id: "issuer-123",
      name: "Server Updated Name",
      status: "SUSPENDED",
      organizationId: "org-456",
    });

    (issuersApi.updateIssuer as jest.Mock).mockRejectedValue(conflictError);

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Check field names appear
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("allows reload from server for issuers", async () => {
    const conflictError = new ApiConflictError({
      id: "issuer-123",
      name: "Updated Issuer Name",
      status: "SUSPENDED",
      organizationId: "org-123",
    });

    (issuersApi.updateIssuer as jest.Mock).mockRejectedValue(conflictError);

    const reloadedIssuer: IssuerWithRevision = {
      id: "issuer-123",
      name: "Updated Issuer Name",
      status: "SUSPENDED",
      organizationId: "org-123",
      __revision: "rev-124",
      __loadedAt: new Date().toISOString(),
    };

    (issuersApi.getIssuer as jest.Mock).mockResolvedValue(reloadedIssuer);

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click reload
    const reloadButton = screen.getByText("Reload from Server");
    fireEvent.click(reloadButton);

    await waitFor(() => {
      expect(issuersApi.getIssuer).toHaveBeenCalledWith(
        mockToken,
        "issuer-123",
        expect.any(AbortSignal)
      );
      expect(mockOnUpdate).toHaveBeenCalledWith(reloadedIssuer);
    });
  });

  it("allows retry with local changes for issuers", async () => {
    const conflictError = new ApiConflictError({
      id: "issuer-123",
      name: "Server Updated Name",
      status: "SUSPENDED",
      organizationId: "org-123",
    });

    (issuersApi.updateIssuer as jest.Mock)
      .mockRejectedValueOnce(conflictError)
      .mockResolvedValueOnce({
        id: "issuer-123",
        name: "Test Issuer",
        status: "ACTIVE",
        organizationId: "org-123",
        __revision: "rev-124",
        __loadedAt: new Date().toISOString(),
      });

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click retry
    const retryButton = screen.getByText("Retry with My Changes");
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(issuersApi.updateIssuer).toHaveBeenCalledTimes(2);
      expect(mockOnUpdate).toHaveBeenCalled();
    });
  });

  it("preserves issuer revision tracking through updates", async () => {
    (issuersApi.updateIssuer as jest.Mock).mockResolvedValue({
      id: "issuer-123",
      name: "Test Issuer",
      status: "SUSPENDED",
      organizationId: "org-123",
      __revision: "rev-124",
      __loadedAt: new Date().toISOString(),
    });

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger update
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(issuersApi.updateIssuer).toHaveBeenCalledWith(
        mockToken,
        "issuer-123",
        expect.objectContaining({
          status: "SUSPENDED",
          __revision: mockIssuers[0].__revision,
        }),
        expect.any(AbortSignal)
      );
    });
  });

  it("displays organization name correctly in conflict scenario", async () => {
    const conflictError = new ApiConflictError({
      id: "issuer-123",
      name: "Updated Issuer",
      status: "SUSPENDED",
      organizationId: "org-123",
    });

    (issuersApi.updateIssuer as jest.Mock).mockRejectedValue(conflictError);

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Organization name should be visible
    expect(screen.getByText("Test Organization")).toBeInTheDocument();

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });
  });

  it("allows abandon to close conflict and preserve local state", async () => {
    const conflictError = new ApiConflictError({
      id: "issuer-123",
      name: "Server Updated Name",
      status: "SUSPENDED",
      organizationId: "org-123",
    });

    (issuersApi.updateIssuer as jest.Mock).mockRejectedValue(conflictError);

    render(
      <IssuerList
        issuers={mockIssuers}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Trigger conflict
    const suspendButtons = screen.getAllByText("Suspend");
    fireEvent.click(suspendButtons[0]);

    const confirmButton = screen.getByText("Suspend");
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Update Conflict/)).toBeInTheDocument();
    });

    // Click keep editing
    const keepEditingButton = screen.getByText("Keep Editing");
    fireEvent.click(keepEditingButton);

    await waitFor(() => {
      expect(
        screen.queryByText(/Update Conflict/)
      ).not.toBeInTheDocument();
    });
  });

  it("handles issuers with no organization (independent)", async () => {
    const independentIssuer: IssuerWithRevision = {
      id: "issuer-456",
      name: "Independent Issuer",
      status: "ACTIVE",
      __revision: "rev-456",
      __loadedAt: new Date().toISOString(),
    };

    render(
      <IssuerList
        issuers={[independentIssuer]}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Should show "Independent" for issuers with no organizationId
    expect(screen.getByText("Independent")).toBeInTheDocument();
  });

  it("handles issuers with unknown organization", async () => {
    const issuerWithUnknownOrg: IssuerWithRevision = {
      id: "issuer-789",
      name: "Unknown Org Issuer",
      status: "ACTIVE",
      organizationId: "org-unknown",
      __revision: "rev-789",
      __loadedAt: new Date().toISOString(),
    };

    render(
      <IssuerList
        issuers={[issuerWithUnknownOrg]}
        organizations={mockOrganizations}
        loading={false}
        token={mockToken}
        onIssuerUpdated={mockOnUpdate}
      />
    );

    // Should show "Unknown Organization" for unmatched organizationId
    expect(screen.getByText("Unknown Organization")).toBeInTheDocument();
  });
});
