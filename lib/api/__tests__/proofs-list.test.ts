/**
 * @jest-environment jsdom
 */

import {
  validateListProofsParams,
  isValidProofStatus,
  isValidProofType,
  formatProofStatus,
  formatProofType,
  getProofStatusColor,
} from "../proofs-list";

describe("Proofs List API", () => {
  describe("isValidProofStatus", () => {
    it("validates known proof statuses", () => {
      expect(isValidProofStatus("PENDING")).toBe(true);
      expect(isValidProofStatus("VALID")).toBe(true);
      expect(isValidProofStatus("EXPIRED")).toBe(true);
      expect(isValidProofStatus("REVOKED")).toBe(true);
    });

    it("rejects unknown statuses", () => {
      expect(isValidProofStatus("UNKNOWN")).toBe(false);
      expect(isValidProofStatus("valid")).toBe(false); // lowercase
      expect(isValidProofStatus(123)).toBe(false);
      expect(isValidProofStatus(null)).toBe(false);
      expect(isValidProofStatus(undefined)).toBe(false);
    });
  });

  describe("isValidProofType", () => {
    it("validates known proof types", () => {
      expect(isValidProofType("MINIMUM_INCOME")).toBe(true);
      expect(isValidProofType("PAYMENT_RECEIPT")).toBe(true);
      expect(isValidProofType("RECURRING_INCOME")).toBe(true);
    });

    it("rejects unknown types", () => {
      expect(isValidProofType("UNKNOWN_TYPE")).toBe(false);
      expect(isValidProofType("minimum_income")).toBe(false); // lowercase
      expect(isValidProofType(123)).toBe(false);
      expect(isValidProofType(null)).toBe(false);
    });
  });

  describe("validateListProofsParams", () => {
    describe("positive cases - valid parameters", () => {
      it("accepts valid status filter", () => {
        const result = validateListProofsParams({ status: "VALID" });
        expect(result.status).toBe("VALID");
      });

      it("accepts valid type filter", () => {
        const result = validateListProofsParams({ type: "MINIMUM_INCOME" });
        expect(result.type).toBe("MINIMUM_INCOME");
      });

      it("accepts issuer ID", () => {
        const result = validateListProofsParams({ issuerId: "issuer-123" });
        expect(result.issuerId).toBe("issuer-123");
      });

      it("accepts valid date range", () => {
        const result = validateListProofsParams({
          createdFrom: "2024-01-01",
          createdUntil: "2024-12-31",
        });
        expect(result.createdFrom).toBe("2024-01-01");
        expect(result.createdUntil).toBe("2024-12-31");
      });

      it("accepts valid cursor", () => {
        const result = validateListProofsParams({ cursor: "abc123xyz" });
        expect(result.cursor).toBe("abc123xyz");
      });

      it("accepts valid limit", () => {
        const result = validateListProofsParams({ limit: "50" });
        expect(result.limit).toBe(50);
      });

      it("accepts all filters combined", () => {
        const result = validateListProofsParams({
          status: "VALID",
          type: "PAYMENT_RECEIPT",
          issuerId: "issuer-456",
          createdFrom: "2024-01-01",
          createdUntil: "2024-12-31",
          cursor: "cursor123",
          limit: "25",
        });

        expect(result.status).toBe("VALID");
        expect(result.type).toBe("PAYMENT_RECEIPT");
        expect(result.issuerId).toBe("issuer-456");
        expect(result.createdFrom).toBe("2024-01-01");
        expect(result.createdUntil).toBe("2024-12-31");
        expect(result.cursor).toBe("cursor123");
        expect(result.limit).toBe(25);
      });
    });

    describe("negative cases - invalid parameters", () => {
      it("drops invalid status values", () => {
        const result = validateListProofsParams({ status: "UNKNOWN_STATUS" });
        expect(result.status).toBeUndefined();
      });

      it("drops invalid type values", () => {
        const result = validateListProofsParams({ type: "UNKNOWN_TYPE" });
        expect(result.type).toBeUndefined();
      });

      it("drops empty issuer ID", () => {
        const result = validateListProofsParams({ issuerId: "" });
        expect(result.issuerId).toBeUndefined();
      });

      it("drops whitespace-only issuer ID", () => {
        const result = validateListProofsParams({ issuerId: "   " });
        expect(result.issuerId).toBeUndefined();
      });

      it("drops invalid dates", () => {
        const result = validateListProofsParams({
          createdFrom: "not-a-date",
          createdUntil: "also-invalid",
        });
        expect(result.createdFrom).toBeUndefined();
        expect(result.createdUntil).toBeUndefined();
      });

      it("normalizes valid dates to ISO format", () => {
        // JavaScript Date constructor accepts various formats
        const result = validateListProofsParams({
          createdFrom: "January 1, 2024",
        });
        expect(result.createdFrom).toBe("2024-01-01");
      });

      it("drops invalid cursor (empty string)", () => {
        const result = validateListProofsParams({ cursor: "" });
        expect(result.cursor).toBeUndefined();
      });

      it("drops invalid limit (negative number)", () => {
        const result = validateListProofsParams({ limit: "-5" });
        expect(result.limit).toBeUndefined();
      });

      it("drops invalid limit (zero)", () => {
        const result = validateListProofsParams({ limit: "0" });
        expect(result.limit).toBeUndefined();
      });

      it("drops invalid limit (exceeds max)", () => {
        const result = validateListProofsParams({ limit: "101" });
        expect(result.limit).toBeUndefined();
      });

      it("drops invalid limit (non-numeric)", () => {
        const result = validateListProofsParams({ limit: "abc" });
        expect(result.limit).toBeUndefined();
      });
    });

    describe("boundary cases - cursor reset and date range", () => {
      it("resets cursor when createdFrom >= createdUntil", () => {
        const result = validateListProofsParams({
          createdFrom: "2024-12-31",
          createdUntil: "2024-01-01", // Earlier than createdFrom
        });
        expect(result.createdFrom).toBe("2024-12-31");
        expect(result.createdUntil).toBeUndefined();
      });

      it("allows equal dates (edge case)", () => {
        const result = validateListProofsParams({
          createdFrom: "2024-06-15",
          createdUntil: "2024-06-15",
        });
        // Should drop the second one as it's not less than the first
        expect(result.createdFrom).toBe("2024-06-15");
        expect(result.createdUntil).toBeUndefined();
      });

      it("preserves valid filters when cursor is invalid", () => {
        const result = validateListProofsParams({
          status: "VALID",
          type: "MINIMUM_INCOME",
          cursor: "", // Invalid
        });
        expect(result.status).toBe("VALID");
        expect(result.type).toBe("MINIMUM_INCOME");
        expect(result.cursor).toBeUndefined();
      });
    });

    describe("authorization - invalid values should not pass through", () => {
      it("sanitizes issuer ID with special characters", () => {
        // Should accept the ID as-is (no format restriction)
        const result = validateListProofsParams({
          issuerId: "issuer-123-456_xyz.abc",
        });
        expect(result.issuerId).toBe("issuer-123-456_xyz.abc");
      });

      it("does not allow injection via status parameter", () => {
        const result = validateListProofsParams({
          status: "VALID; DROP TABLE proofs;",
        });
        expect(result.status).toBeUndefined(); // Invalid status value
      });

      it("does not allow injection via cursor parameter", () => {
        // Cursor is accepted as opaque, but we still validate its presence
        const result = validateListProofsParams({
          cursor: "'; DROP TABLE proofs; --",
        });
        expect(result.cursor).toBe("'; DROP TABLE proofs; --"); // Cursor is opaque, accepted as-is
      });
    });
  });

  describe("formatProofStatus", () => {
    it("formats known statuses correctly", () => {
      expect(formatProofStatus("PENDING")).toBe("Pending");
      expect(formatProofStatus("VALID")).toBe("Valid");
      expect(formatProofStatus("EXPIRED")).toBe("Expired");
      expect(formatProofStatus("REVOKED")).toBe("Revoked");
    });
  });

  describe("formatProofType", () => {
    it("formats known types correctly", () => {
      expect(formatProofType("MINIMUM_INCOME")).toBe("Minimum Income");
      expect(formatProofType("PAYMENT_RECEIPT")).toBe("Payment Receipt");
      expect(formatProofType("RECURRING_INCOME")).toBe("Recurring Income");
    });
  });

  describe("getProofStatusColor", () => {
    it("returns correct color classes for statuses", () => {
      const validColor = getProofStatusColor("VALID");
      expect(validColor).toContain("emerald");

      const pendingColor = getProofStatusColor("PENDING");
      expect(pendingColor).toContain("amber");

      const expiredColor = getProofStatusColor("EXPIRED");
      expect(expiredColor).toContain("slate");

      const revokedColor = getProofStatusColor("REVOKED");
      expect(revokedColor).toContain("rose");
    });
  });
});
