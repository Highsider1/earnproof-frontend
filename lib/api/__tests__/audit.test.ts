/**
 * @jest-environment jsdom
 */

import { validateDateRange, formatChainVerificationStatus, MAX_DATE_RANGE_DAYS } from "../audit";

describe("validateDateRange", () => {
  it("allows an unset range (no filter applied)", () => {
    expect(validateDateRange(undefined, undefined)).toBeNull();
    expect(validateDateRange("2026-08-01", undefined)).toBeNull();
  });

  it("rejects an inverted range", () => {
    expect(validateDateRange("2026-08-31", "2026-08-01")).toBe("Start date must be before end date");
  });

  it("accepts a range within the bound", () => {
    expect(validateDateRange("2026-08-01", "2026-08-31")).toBeNull();
  });

  it("rejects a range exceeding the maximum span", () => {
    const from = new Date("2026-01-01");
    const to = new Date(from.getTime() + (MAX_DATE_RANGE_DAYS + 1) * 24 * 60 * 60 * 1000);
    const result = validateDateRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    expect(result).toMatch(/cannot exceed/);
  });

  it("accepts a range exactly at the maximum span boundary", () => {
    const from = new Date("2026-01-01");
    const to = new Date(from.getTime() + MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000);
    const result = validateDateRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
    expect(result).toBeNull();
  });

  it("rejects invalid dates", () => {
    expect(validateDateRange("not-a-date", "2026-08-31")).toBe("Invalid date");
  });
});

describe("formatChainVerificationStatus", () => {
  it("gives distinct messaging for a broken chain vs an intact one", () => {
    const intact = formatChainVerificationStatus("INTACT");
    const broken = formatChainVerificationStatus("BROKEN");
    expect(intact).not.toBe(broken);
    expect(broken.toLowerCase()).toContain("broken");
  });

  it("never phrases a broken or unknown result as success", () => {
    expect(formatChainVerificationStatus("BROKEN").toLowerCase()).not.toContain("success");
    expect(formatChainVerificationStatus("UNKNOWN").toLowerCase()).not.toContain("success");
  });
});
