/**
 * @jest-environment jsdom
 */

import { stateToApiParams, isCursorStale } from "../use-proof-history-state";
import type { ProofHistoryState } from "../use-proof-history-state";

describe("useProofHistoryState utilities", () => {
  describe("stateToApiParams", () => {
    it("converts state filters to API parameters", () => {
      const state: ProofHistoryState = {
        filters: {
          status: "VALID",
          type: "MINIMUM_INCOME",
          issuerId: "issuer-123",
          createdFrom: "2024-01-01",
          createdUntil: "2024-12-31",
        },
        limit: 20,
      };

      const params = stateToApiParams(state);

      expect(params.status).toBe("VALID");
      expect(params.type).toBe("MINIMUM_INCOME");
      expect(params.issuerId).toBe("issuer-123");
      expect(params.createdFrom).toBe("2024-01-01");
      expect(params.createdUntil).toBe("2024-12-31");
      expect(params.limit).toBe(20);
      expect(params.cursor).toBeUndefined();
    });

    it("includes cursor when present", () => {
      const state: ProofHistoryState = {
        filters: {},
        cursor: "cursor-abc123",
        limit: 20,
      };

      const params = stateToApiParams(state);
      expect(params.cursor).toBe("cursor-abc123");
    });

    it("excludes invalid cursor when validator returns false", () => {
      const state: ProofHistoryState = {
        filters: {},
        cursor: "stale-cursor",
        limit: 20,
      };

      const isValidCursor = (cursor: string) => !cursor.startsWith("stale");

      const params = stateToApiParams(state, isValidCursor);
      expect(params.cursor).toBeUndefined();
    });

    it("includes cursor when validator returns true", () => {
      const state: ProofHistoryState = {
        filters: {},
        cursor: "valid-cursor-xyz",
        limit: 20,
      };

      const isValidCursor = (cursor: string) => cursor.startsWith("valid");

      const params = stateToApiParams(state, isValidCursor);
      expect(params.cursor).toBe("valid-cursor-xyz");
    });

    it("handles partial filters", () => {
      const state: ProofHistoryState = {
        filters: {
          status: "PENDING",
          // Only status is set, other filters undefined
        },
        limit: 25,
      };

      const params = stateToApiParams(state);
      expect(params.status).toBe("PENDING");
      expect(params.type).toBeUndefined();
      expect(params.issuerId).toBeUndefined();
      expect(params.createdFrom).toBeUndefined();
      expect(params.createdUntil).toBeUndefined();
    });

    it("handles no filters at all", () => {
      const state: ProofHistoryState = {
        filters: {},
        limit: 20,
      };

      const params = stateToApiParams(state);
      expect(Object.keys(params).filter((k) => params[k as keyof typeof params] !== undefined)).toEqual(["limit"]);
    });
  });

  describe("isCursorStale", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-06-15T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("returns false when cursor is undefined", () => {
      const result = isCursorStale(undefined, Date.now() - 30 * 60 * 1000); // 30 min ago
      expect(result).toBe(false);
    });

    it("returns false when lastFetchedAt is undefined", () => {
      const result = isCursorStale("cursor-123", undefined);
      expect(result).toBe(false);
    });

    it("returns false when both are undefined", () => {
      const result = isCursorStale(undefined, undefined);
      expect(result).toBe(false);
    });

    it("returns false when cursor is recent (< 1 hour)", () => {
      const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000;
      const result = isCursorStale("cursor-123", thirtyMinutesAgo);
      expect(result).toBe(false);
    });

    it("returns false at exactly 1 hour boundary (not yet stale)", () => {
      const oneHourAgo = Date.now() - 60 * 60 * 1000;
      const result = isCursorStale("cursor-123", oneHourAgo);
      expect(result).toBe(false);
    });

    it("returns true when cursor is stale (> 1 hour)", () => {
      const oneHourAndOneMinuteAgo = Date.now() - (60 * 60 * 1000 + 60 * 1000);
      const result = isCursorStale("cursor-123", oneHourAndOneMinuteAgo);
      expect(result).toBe(true);
    });

    it("returns true when cursor is very stale (days old)", () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const result = isCursorStale("cursor-123", twoDaysAgo);
      expect(result).toBe(true);
    });

    it("handles timestamps from far past", () => {
      const farPast = 0; // Unix epoch
      const result = isCursorStale("cursor-123", farPast);
      expect(result).toBe(true);
    });
  });

  describe("URL state persistence and browser navigation", () => {
    beforeEach(() => {
      // Mock window.history
      (window.history.replaceState as jest.Mock) = jest.fn();
    });

    it("would preserve state across browser back/forward via URL", () => {
      // This is a behavioral test - actual hook testing requires React Testing Library
      // but we verify the URL parameter schema is correct

      const state: ProofHistoryState = {
        filters: {
          status: "VALID",
          type: "PAYMENT_RECEIPT",
        },
        cursor: "cursor-123",
        limit: 50,
      };

      const params = stateToApiParams(state);

      // Verify all necessary params are present for URL persistence
      expect(params).toHaveProperty("status");
      expect(params).toHaveProperty("type");
      expect(params).toHaveProperty("cursor");
      expect(params).toHaveProperty("limit");
    });
  });

  describe("stale cursor reset behavior", () => {
    it("stale cursor would be reset without losing filters", () => {
      const state: ProofHistoryState = {
        filters: {
          status: "VALID",
          type: "MINIMUM_INCOME",
          issuerId: "issuer-abc",
        },
        cursor: "stale-cursor", // Would be detected as stale
        limit: 20,
      };

      // Simulate cursor validation that detects staleness
      const isValidCursor = () => false; // Cursor is stale

      const params = stateToApiParams(state, isValidCursor);

      // Cursor should be excluded
      expect(params.cursor).toBeUndefined();

      // But filters should be preserved
      expect(params.status).toBe("VALID");
      expect(params.type).toBe("MINIMUM_INCOME");
      expect(params.issuerId).toBe("issuer-abc");
    });
  });
});
