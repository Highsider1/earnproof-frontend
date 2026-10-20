import { render, screen, fireEvent } from "@testing-library/react";
import { ResolveConflictDialog, type ConflictValue } from "../resolve-conflict-dialog";

describe("ResolveConflictDialog", () => {
  const mockConflicts: ConflictValue[] = [
    {
      field: "name",
      label: "Name",
      serverValue: "Updated Organization",
      localValue: "My Organization",
      changed: true,
    },
    {
      field: "status",
      label: "Status",
      serverValue: "SUSPENDED",
      localValue: "ACTIVE",
      changed: true,
    },
    {
      field: "website",
      label: "Website",
      serverValue: "https://new-site.com",
      localValue: "https://new-site.com",
      changed: false,
    },
  ];

  const mockLocalFormState = {
    name: "My Organization",
    status: "ACTIVE",
    website: "https://new-site.com",
  };

  const mockCallbacks = {
    onRetry: jest.fn(),
    onReload: jest.fn(),
    onAbandon: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders conflict dialog with title and description", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(/Update Conflict: Organization/)).toBeInTheDocument();
    expect(
      screen.getByText(/This organization was modified on the server/)
    ).toBeInTheDocument();
  });

  it("displays conflicting field values side-by-side", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    // Check for conflict fields
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Updated Organization")).toBeInTheDocument();
    expect(screen.getByText("My Organization")).toBeInTheDocument();
  });

  it("categorizes conflicts correctly (both changed)", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    // Should show warning about conflicting changes
    expect(
      screen.getByText(/Conflicting changes \(both you and server modified\)/)
    ).toBeInTheDocument();
  });

  it("calls onRetry with form state when retry button clicked", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    const retryButton = screen.getByRole("button", {
      name: /Retry with My Changes/,
    });
    fireEvent.click(retryButton);

    expect(mockCallbacks.onRetry).toHaveBeenCalledWith(mockLocalFormState);
  });

  it("calls onReload when reload button clicked", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    const reloadButton = screen.getByRole("button", {
      name: /Reload from Server/,
    });
    fireEvent.click(reloadButton);

    expect(mockCallbacks.onReload).toHaveBeenCalled();
  });

  it("calls onAbandon when keep editing button clicked", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    const abandonButton = screen.getByRole("button", {
      name: /Keep Editing/,
    });
    fireEvent.click(abandonButton);

    expect(mockCallbacks.onAbandon).toHaveBeenCalled();
  });

  it("disables buttons when isRetrying is true", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
        isRetrying={true}
      />
    );

    const retryButton = screen.getByRole("button", {
      name: /Retrying/,
    });
    expect(retryButton).toBeDisabled();

    const reloadButton = screen.getByRole("button", {
      name: /Reload from Server/,
    });
    expect(reloadButton).toBeDisabled();
  });

  it("formats field labels correctly", () => {
    const testConflicts: ConflictValue[] = [
      {
        field: "organizationId",
        label: "Organization ID",
        serverValue: "org-1",
        localValue: "org-2",
        changed: true,
      },
    ];

    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={testConflicts}
        localFormState={{ organizationId: "org-2" }}
        {...mockCallbacks}
      />
    );

    expect(screen.getByText("Organization ID")).toBeInTheDocument();
  });

  it("displays empty values as (empty)", () => {
    const testConflicts: ConflictValue[] = [
      {
        field: "website",
        label: "Website",
        serverValue: undefined,
        localValue: "",
        changed: true,
      },
    ];

    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={testConflicts}
        localFormState={{ website: "" }}
        {...mockCallbacks}
      />
    );

    // Should show "(empty)" for both values
    const emptyValues = screen.getAllByText("(empty)");
    expect(emptyValues.length).toBeGreaterThanOrEqual(1);
  });

  it("has proper ARIA attributes for accessibility", () => {
    render(
      <ResolveConflictDialog
        entityType="Organization"
        entityId="org-123"
        conflicts={mockConflicts}
        localFormState={mockLocalFormState}
        {...mockCallbacks}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "conflict-dialog-title");
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "conflict-dialog-description"
    );
  });
});
