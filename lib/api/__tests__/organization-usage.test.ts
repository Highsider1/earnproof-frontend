/**
 * @jest-environment jsdom
 */

import {
  getUsageLevel,
  getUsageLevelLabel,
  getUsageLevelTone,
  getUsagePercentage,
  formatUsageResource,
} from "../organization-usage";

describe("Organization Usage Utilities", () => {
  describe("getUsageLevel", () => {
    it("returns unlimited when limit is null, regardless of usage", () => {
      expect(getUsageLevel({ used: 0, limit: null })).toBe("unlimited");
      expect(getUsageLevel({ used: 999_999, limit: null })).toBe("unlimited");
    });

    it("returns nominal when comfortably under limit", () => {
      expect(getUsageLevel({ used: 10, limit: 100 })).toBe("nominal");
    });

    it("returns warning at the 80% threshold", () => {
      expect(getUsageLevel({ used: 80, limit: 100 })).toBe("warning");
      expect(getUsageLevel({ used: 79, limit: 100 })).toBe("nominal");
    });

    it("returns exceeded when used meets or exceeds limit", () => {
      expect(getUsageLevel({ used: 100, limit: 100 })).toBe("exceeded");
      expect(getUsageLevel({ used: 150, limit: 100 })).toBe("exceeded");
    });

    it("handles a zero limit without dividing by zero", () => {
      expect(getUsageLevel({ used: 0, limit: 0 })).toBe("nominal");
      expect(getUsageLevel({ used: 1, limit: 0 })).toBe("exceeded");
    });
  });

  describe("getUsagePercentage", () => {
    it("returns null for unlimited resources", () => {
      expect(getUsagePercentage({ used: 50, limit: null })).toBeNull();
    });

    it("computes a rounded percentage", () => {
      expect(getUsagePercentage({ used: 1, limit: 3 })).toBe(33);
      expect(getUsagePercentage({ used: 50, limit: 100 })).toBe(50);
    });

    it("clamps to 100 when usage exceeds the limit", () => {
      expect(getUsagePercentage({ used: 150, limit: 100 })).toBe(100);
    });

    it("clamps to 0 for a zero-usage, zero-limit resource", () => {
      expect(getUsagePercentage({ used: 0, limit: 0 })).toBe(0);
    });

    it("returns 100 for any positive usage against a zero limit", () => {
      expect(getUsagePercentage({ used: 5, limit: 0 })).toBe(100);
    });
  });

  describe("getUsageLevelLabel / getUsageLevelTone", () => {
    it("labels and tones each level", () => {
      expect(getUsageLevelLabel("nominal")).toBe("Within limit");
      expect(getUsageLevelTone("nominal")).toBe("success");
      expect(getUsageLevelLabel("warning")).toBe("Near limit");
      expect(getUsageLevelTone("warning")).toBe("warning");
      expect(getUsageLevelLabel("exceeded")).toBe("Limit exceeded");
      expect(getUsageLevelTone("exceeded")).toBe("warning");
      expect(getUsageLevelLabel("unlimited")).toBe("Unlimited");
      expect(getUsageLevelTone("unlimited")).toBe("accent");
    });
  });

  describe("formatUsageResource", () => {
    it("formats known resources", () => {
      expect(formatUsageResource("API_KEYS")).toBe("API Keys");
      expect(formatUsageResource("WEBHOOKS")).toBe("Webhooks");
      expect(formatUsageResource("PROOFS")).toBe("Proofs");
      expect(formatUsageResource("SYNCHRONIZATION")).toBe("Synchronization");
    });
  });
});
