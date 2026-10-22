import {
  updateOrganizationSafe,
  performLifecycleAction,
  getStatusForLifecycleAction,
  type LifecycleAction,
} from "../organizations";
import * as errorNormalization from "../error-normalization";

jest.mock("../organizations", () => {
  const originalModule = jest.requireActual("../organizations");
  return {
    ...originalModule,
  };
});

jest.mock("../error-normalization");

const mockOrganization = {
  id: "org-123",
  name: "Test Organization",
  slug: "test-org",
  website: "https://example.com",
  status: "ACTIVE" as const,
};

describe("organizations API", () => {
  const mockToken = "test-token";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getStatusForLifecycleAction", () => {
    it("should map activate to ACTIVE", () => {
      expect(getStatusForLifecycleAction("activate")).toBe("ACTIVE");
    });

    it("should map suspend to SUSPENDED", () => {
      expect(getStatusForLifecycleAction("suspend")).toBe("SUSPENDED");
    });

    it("should map archive to REVOKED", () => {
      expect(getStatusForLifecycleAction("archive")).toBe("REVOKED");
    });

    it("should map revoke to REVOKED", () => {
      expect(getStatusForLifecycleAction("revoke")).toBe("REVOKED");
    });
  });

  describe("updateOrganizationSafe", () => {
    it("should return success result on successful update", async () => {
      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockResolvedValue(mockOrganization);

      const controller = new AbortController();
      const result = await updateOrganizationSafe(
        mockToken,
        "org-123",
        { name: "Updated Name" },
        controller.signal
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual(mockOrganization);
      }
    });

    it("should return error result on API failure", async () => {
      const error = new Error("HTTP 400");
      (error as any).statusCode = 400;

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "Validation failed",
        type: "validation",
        fieldErrors: { name: "Too short" },
        isRetryable: false,
      });

      const controller = new AbortController();
      const result = await updateOrganizationSafe(
        mockToken,
        "org-123",
        { name: "X" },
        controller.signal
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("validation");
        expect(result.error.fieldErrors.name).toBe("Too short");
      }
    });

    it("should normalize error response on conflict", async () => {
      const error = new Error("HTTP 409");
      (error as any).statusCode = 409;

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "Resource modified",
        type: "conflict",
        fieldErrors: {},
        statusCode: 409,
        isRetryable: true,
      });

      const controller = new AbortController();
      const result = await updateOrganizationSafe(
        mockToken,
        "org-123",
        { name: "Updated" },
        controller.signal
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("conflict");
        expect(result.error.statusCode).toBe(409);
      }
    });
  });

  describe("performLifecycleAction", () => {
    it("should perform suspend action with correct status", async () => {
      const updateOrganization = require("../organizations").updateOrganization;
      const suspendedOrg = { ...mockOrganization, status: "SUSPENDED" as const };
      updateOrganization.mockResolvedValue(suspendedOrg);

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "suspend",
        controller.signal
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("SUSPENDED");
      }
    });

    it("should perform activate action", async () => {
      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockResolvedValue(mockOrganization);

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "activate",
        controller.signal
      );

      expect(result.success).toBe(true);
    });

    it("should perform revoke action", async () => {
      const updateOrganization = require("../organizations").updateOrganization;
      const revokedOrg = { ...mockOrganization, status: "REVOKED" as const };
      updateOrganization.mockResolvedValue(revokedOrg);

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "revoke",
        controller.signal
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe("REVOKED");
      }
    });

    it("should handle lifecycle action errors", async () => {
      const error = new Error("HTTP 409");
      (error as any).statusCode = 409;

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "Conflict",
        type: "conflict",
        fieldErrors: {},
        statusCode: 409,
        isRetryable: true,
      });

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "suspend",
        controller.signal
      );

      expect(result.success).toBe(false);
    });
  });

  describe("error handling across operations", () => {
    it("should handle network timeout in lifecycle action", async () => {
      const error = new Error("timeout");
      error.name = "AbortError";

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "Request timeout",
        type: "network",
        fieldErrors: {},
        isRetryable: true,
      });

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "suspend",
        controller.signal
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.isRetryable).toBe(true);
      }
    });

    it("should handle validation errors with field details", async () => {
      const error = new Error("HTTP 400");
      (error as any).statusCode = 400;

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "Validation failed",
        type: "validation",
        fieldErrors: {
          name: "Name already in use",
          website: "Invalid domain",
        },
        isRetryable: false,
      });

      const controller = new AbortController();
      const result = await updateOrganizationSafe(
        mockToken,
        "org-123",
        { name: "Taken", website: "invalid" },
        controller.signal
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(Object.keys(result.error.fieldErrors).length).toBe(2);
      }
    });
  });

  describe("authorization errors", () => {
    it("should handle 403 authorization error in lifecycle action", async () => {
      const error = new Error("HTTP 403");
      (error as any).statusCode = 403;

      const updateOrganization = require("../organizations").updateOrganization;
      updateOrganization.mockRejectedValue(error);

      (errorNormalization.normalizeError as jest.Mock).mockResolvedValue({
        message: "You do not have permission",
        type: "authorization",
        fieldErrors: {},
        statusCode: 403,
        isRetryable: false,
      });

      const controller = new AbortController();
      const result = await performLifecycleAction(
        mockToken,
        "org-123",
        "suspend",
        controller.signal
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe("authorization");
      }
    });
  });
});
