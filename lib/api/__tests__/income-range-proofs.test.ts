/**
 * @jest-environment jsdom
 */

import { validateIncomeRange, formatIncomeRange, MIN_RANGE_WIDTH } from "../income-range-proofs";

describe("validateIncomeRange", () => {
  it("requires a lower bound", () => {
    expect(validateIncomeRange(undefined, "500")).toBe("A lower bound is required");
    expect(validateIncomeRange("", "500")).toBe("A lower bound is required");
  });

  it("requires an upper bound", () => {
    expect(validateIncomeRange("100", undefined)).toBe("An upper bound is required");
    expect(validateIncomeRange("100", "")).toBe("An upper bound is required");
  });

  it("rejects non-numeric bounds", () => {
    expect(validateIncomeRange("abc", "500")).toBe("Bounds must be numeric");
    expect(validateIncomeRange("100", "xyz")).toBe("Bounds must be numeric");
  });

  it("rejects negative bounds", () => {
    expect(validateIncomeRange("-100", "500")).toBe("Bounds cannot be negative");
    expect(validateIncomeRange("100", "-500")).toBe("Bounds cannot be negative");
  });

  it("rejects an inverted range (lower >= upper)", () => {
    expect(validateIncomeRange("500", "100")).toBe("Upper bound must be greater than the lower bound");
  });

  it("rejects an equal-bounds range (zero-width, still inverted by the >= check)", () => {
    expect(validateIncomeRange("100", "100")).toBe("Upper bound must be greater than the lower bound");
  });

  it("rejects an over-precise range narrower than the minimum width", () => {
    const tooNarrow = String(MIN_RANGE_WIDTH - 1);
    expect(validateIncomeRange("100", String(100 + Number(tooNarrow)))).toMatch(/at least/);
  });

  it("accepts a range exactly at the minimum width boundary", () => {
    expect(validateIncomeRange("100", String(100 + MIN_RANGE_WIDTH))).toBeNull();
  });

  it("accepts a valid, sufficiently wide range", () => {
    expect(validateIncomeRange("100", "1000")).toBeNull();
  });
});

describe("formatIncomeRange", () => {
  it("formats the range with the asset code", () => {
    expect(formatIncomeRange("100", "500", "USDC")).toBe("100 - 500 USDC");
  });
});
