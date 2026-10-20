/**
 * @jest-environment jsdom
 */

import {
  validateIssuerName,
  formatIssuerStatus,
  getIssuerStatusTone,
  allowedIssuerTransitions,
  canPerformIssuerTransition,
} from "../issuers";

describe("Issuer Utilities", () => {
  describe("validateIssuerName", () => {
    it("returns null for valid names", () => {
      expect(validateIssuerName("Veridatum Labs")).toBeNull();
      expect(validateIssuerName("Stellar Community Fund")).toBeNull();
      expect(validateIssuerName("AB")).toBeNull(); // Minimum length
    });

    it("requires non-empty name", () => {
      expect(validateIssuerName("")).toBe("Issuer name is required");
      expect(validateIssuerName("   ")).toBe("Issuer name is required");
    });

    it("requires minimum length", () => {
      expect(validateIssuerName("A")).toBe("Issuer name must be at least 2 characters");
    });

    it("enforces maximum length", () => {
      const longName = "a".repeat(101);
      expect(validateIssuerName(longName)).toBe("Issuer name must be less than 100 characters");
    });

    it("trims whitespace", () => {
      expect(validateIssuerName("  Valid Issuer  ")).toBeNull();
    });
  });

  describe("formatIssuerStatus", () => {
    it("formats status correctly", () => {
      expect(formatIssuerStatus("ACTIVE")).toBe("Active");
      expect(formatIssuerStatus("PENDING")).toBe("Pending");
      expect(formatIssuerStatus("SUSPENDED")).toBe("Suspended");
      expect(formatIssuerStatus("REVOKED")).toBe("Revoked");
    });

    it("returns original value for unknown status", () => {
      expect(formatIssuerStatus("UNKNOWN" as unknown as Parameters<typeof formatIssuerStatus>[0])).toBe("UNKNOWN");
    });
  });

  describe("getIssuerStatusTone", () => {
    it("returns correct tones for status", () => {
      expect(getIssuerStatusTone("ACTIVE")).toBe("success");
      expect(getIssuerStatusTone("PENDING")).toBe("warning");
      expect(getIssuerStatusTone("SUSPENDED")).toBe("warning");
      expect(getIssuerStatusTone("REVOKED")).toBe("warning");
    });

    it("returns accent for unknown status", () => {
      expect(getIssuerStatusTone("UNKNOWN" as unknown as Parameters<typeof getIssuerStatusTone>[0])).toBe("accent");
    });
  });

  describe("allowedIssuerTransitions (#141)", () => {
    it("grants ADMIN every transition", () => {
      expect(allowedIssuerTransitions("ADMIN")).toEqual(["activate", "suspend", "revoke"]);
    });

    it("limits ISSUER to activate and suspend, never revoke", () => {
      const transitions = allowedIssuerTransitions("ISSUER");
      expect(transitions).toEqual(["activate", "suspend"]);
      expect(transitions).not.toContain("revoke");
    });

    it("grants WORKER and DEVELOPER no issuer transitions", () => {
      expect(allowedIssuerTransitions("WORKER")).toEqual([]);
      expect(allowedIssuerTransitions("DEVELOPER")).toEqual([]);
    });

    it("returns no transitions for an undefined or unrecognized role", () => {
      expect(allowedIssuerTransitions(undefined)).toEqual([]);
      expect(allowedIssuerTransitions("something-unexpected")).toEqual([]);
    });
  });

  describe("canPerformIssuerTransition (#141)", () => {
    it("allows ADMIN to revoke", () => {
      expect(canPerformIssuerTransition("ADMIN", "revoke")).toBe(true);
    });

    it("denies ISSUER from revoking", () => {
      expect(canPerformIssuerTransition("ISSUER", "revoke")).toBe(false);
    });

    it("allows ISSUER to activate and suspend", () => {
      expect(canPerformIssuerTransition("ISSUER", "activate")).toBe(true);
      expect(canPerformIssuerTransition("ISSUER", "suspend")).toBe(true);
    });

    it("denies every transition for an unauthenticated (undefined) role", () => {
      expect(canPerformIssuerTransition(undefined, "activate")).toBe(false);
      expect(canPerformIssuerTransition(undefined, "suspend")).toBe(false);
      expect(canPerformIssuerTransition(undefined, "revoke")).toBe(false);
    });
  });
});
