import { renderHook, act, waitFor } from "@testing-library/react";
import { useConflictResolution } from "../use-conflict-resolution";
import { ApiConflictError } from "@/lib/api/client";

describe("useConflictResolution", () => {
  const mockReloadEntity = jest.fn();
  const mockRetrySubmit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("initializes with no active conflict", () => {
    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    expect(result.current.conflict.isActive).toBe(false);
    expect(result.current.conflict.conflicts.length).toBe(0);
    expect(result.current.isRetrying).toBe(false);
    expect(result.current.isReloading).toBe(false);
  });

  it("shows conflict when showConflict is called with ApiConflictError", () => {
    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = {
      id: "org-123",
      name: "Server Name",
      status: "SUSPENDED",
    };

    const localFormState = {
      id: "org-123",
      name: "Local Name",
      status: "ACTIVE",
    };

    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState, ["name", "status"]);
    });

    expect(result.current.conflict.isActive).toBe(true);
    expect(result.current.conflict.conflicts.length).toBe(2);
    expect(result.current.conflict.conflicts[0].field).toBe("name");
    expect(result.current.conflict.conflicts[0].serverValue).toBe("Server Name");
    expect(result.current.conflict.conflicts[0].localValue).toBe("Local Name");
    expect(result.current.conflict.conflicts[0].changed).toBe(true);
  });

  it("identifies fields changed only on server", () => {
    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = {
      id: "org-123",
      name: "Updated Server Name",
      status: "SUSPENDED",
    };

    const localFormState = {
      id: "org-123",
      name: "Updated Server Name", // Same as server
      status: "ACTIVE",
    };

    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState, ["name", "status"]);
    });

    const nameConflict = result.current.conflict.conflicts.find(
      (c) => c.field === "name"
    );
    expect(nameConflict?.changed).toBe(false); // Not changed by user
  });

  it("calls onReloadEntity when handleReload is called", async () => {
    mockReloadEntity.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = { id: "org-123", name: "Server Name" };
    const localFormState = { id: "org-123", name: "Local Name" };
    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    expect(result.current.conflict.isActive).toBe(true);

    act(() => {
      void result.current.handleReload();
    });

    expect(result.current.isReloading).toBe(true);

    await waitFor(() => {
      expect(mockReloadEntity).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.isReloading).toBe(false);
      expect(result.current.conflict.isActive).toBe(false);
    });
  });

  it("calls onRetrySubmit when handleRetry is called", async () => {
    mockRetrySubmit.mockResolvedValue(undefined);

    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = { id: "org-123", name: "Server Name" };
    const localFormState = { id: "org-123", name: "Local Name" };
    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    act(() => {
      void result.current.handleRetry(localFormState);
    });

    expect(result.current.isRetrying).toBe(true);

    await waitFor(() => {
      expect(mockRetrySubmit).toHaveBeenCalledWith(localFormState);
    });

    await waitFor(() => {
      expect(result.current.isRetrying).toBe(false);
      expect(result.current.conflict.isActive).toBe(false);
    });
  });

  it("calls handleAbandon to close conflict dialog", () => {
    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = { id: "org-123", name: "Server Name" };
    const localFormState = { id: "org-123", name: "Local Name" };
    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    expect(result.current.conflict.isActive).toBe(true);

    act(() => {
      result.current.handleAbandon();
    });

    expect(result.current.conflict.isActive).toBe(false);
  });

  it("handles reload failure gracefully", async () => {
    const reloadError = new Error("Reload failed");
    mockReloadEntity.mockRejectedValue(reloadError);

    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = { id: "org-123", name: "Server Name" };
    const localFormState = { id: "org-123", name: "Local Name" };
    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    act(() => {
      void result.current.handleReload();
    });

    await waitFor(() => {
      expect(result.current.isReloading).toBe(false);
    });

    // Dialog should still be active so user can retry
    expect(result.current.conflict.isActive).toBe(true);
  });

  it("handles retry failure gracefully", async () => {
    const retryError = new Error("Retry failed");
    mockRetrySubmit.mockRejectedValue(retryError);

    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = { id: "org-123", name: "Server Name" };
    const localFormState = { id: "org-123", name: "Local Name" };
    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    act(() => {
      void result.current.handleRetry(localFormState);
    });

    await waitFor(() => {
      expect(result.current.isRetrying).toBe(false);
    });

    // Dialog should still be active so user can try again
    expect(result.current.conflict.isActive).toBe(true);
  });

  it("correctly formats field labels", () => {
    const { result } = renderHook(() =>
      useConflictResolution({
        onReloadEntity: mockReloadEntity,
        onRetrySubmit: mockRetrySubmit,
      })
    );

    const serverEntity = {
      id: "org-123",
      organizationId: "org-456",
      createdAt: "2024-01-01",
      isActive: true,
    };

    const localFormState = {
      organizationId: "org-789",
      createdAt: "2024-01-02",
      isActive: false,
    };

    const error = new ApiConflictError(serverEntity);

    act(() => {
      result.current.showConflict(error, localFormState);
    });

    const labels = result.current.conflict.conflicts.map((c) => c.label);
    expect(labels).toContain("Organization");
    expect(labels).toContain("Created");
    expect(labels).toContain("Is Active");
  });
});
