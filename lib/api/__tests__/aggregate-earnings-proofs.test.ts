/**
 * @jest-environment jsdom
 */

import {
  deriveEarningsSources,
  getUnsupportedAggregationReason,
  validateAggregationPolicy,
  validateSourceSelection,
  formatAggregationPolicy,
  type EarningsSource,
} from "../aggregate-earnings-proofs";

function payment(overrides: Partial<{
  assetCode: string;
  assetIssuer: string | null;
  classification: string;
  isEligible: boolean;
}> = {}) {
  return {
    assetCode: "USDC",
    assetIssuer: null,
    classification: "INCOME",
    isEligible: true,
    ...overrides,
  };
}

describe("deriveEarningsSources", () => {
  it("returns an empty list when there are no eligible income payments", () => {
    expect(deriveEarningsSources([])).toEqual([]);
  });

  it("excludes payments that are not eligible", () => {
    const sources = deriveEarningsSources([payment({ isEligible: false })]);
    expect(sources).toEqual([]);
  });

  it("excludes payments that are not classified as income", () => {
    const sources = deriveEarningsSources([payment({ classification: "REIMBURSEMENT" })]);
    expect(sources).toEqual([]);
  });

  it("groups payments by distinct (assetCode, assetIssuer) source, counting each", () => {
    const sources = deriveEarningsSources([
      payment({ assetCode: "USDC", assetIssuer: null }),
      payment({ assetCode: "USDC", assetIssuer: null }),
      payment({ assetCode: "XLM", assetIssuer: null }),
    ]);

    expect(sources).toHaveLength(2);
    expect(sources.find((s) => s.assetCode === "USDC")).toMatchObject({ paymentCount: 2 });
    expect(sources.find((s) => s.assetCode === "XLM")).toMatchObject({ paymentCount: 1 });
  });

  it("treats the same asset code with different issuers as distinct sources", () => {
    const sources = deriveEarningsSources([
      payment({ assetCode: "USDC", assetIssuer: "ISSUER_A" }),
      payment({ assetCode: "USDC", assetIssuer: "ISSUER_B" }),
    ]);

    expect(sources).toHaveLength(2);
  });
});

describe("getUnsupportedAggregationReason", () => {
  it("returns null when no sources are selected", () => {
    expect(getUnsupportedAggregationReason([], "SUM")).toBeNull();
  });

  it("returns null when all selected sources share one asset", () => {
    const sources: EarningsSource[] = [{ assetCode: "USDC", assetIssuer: null, paymentCount: 2 }];
    expect(getUnsupportedAggregationReason(sources, "SUM")).toBeNull();
  });

  it("returns a reason when selected sources mix assets", () => {
    const sources: EarningsSource[] = [
      { assetCode: "USDC", assetIssuer: null, paymentCount: 1 },
      { assetCode: "XLM", assetIssuer: null, paymentCount: 1 },
    ];
    const reason = getUnsupportedAggregationReason(sources, "SUM");
    expect(reason).toMatch(/multiple assets/i);
  });

  it("treats the same asset code with different issuers as a mix", () => {
    const sources: EarningsSource[] = [
      { assetCode: "USDC", assetIssuer: "ISSUER_A", paymentCount: 1 },
      { assetCode: "USDC", assetIssuer: "ISSUER_B", paymentCount: 1 },
    ];
    expect(getUnsupportedAggregationReason(sources, "SUM")).not.toBeNull();
  });
});

describe("validateAggregationPolicy", () => {
  it("requires a policy", () => {
    expect(validateAggregationPolicy(undefined)).toBe("An aggregation policy is required");
  });

  it("accepts the supported SUM policy", () => {
    expect(validateAggregationPolicy("SUM")).toBeNull();
  });
});

describe("validateSourceSelection", () => {
  it("requires at least one selected payment (empty eligibility)", () => {
    expect(validateSourceSelection([], [], "SUM")).toBe("Select at least one eligible payment");
  });

  it("rejects a mixed-asset selection even when payments are selected", () => {
    const sources: EarningsSource[] = [
      { assetCode: "USDC", assetIssuer: null, paymentCount: 1 },
      { assetCode: "XLM", assetIssuer: null, paymentCount: 1 },
    ];
    const result = validateSourceSelection(["pay-1", "pay-2"], sources, "SUM");
    expect(result).toMatch(/multiple assets/i);
  });

  it("accepts a single-asset selection with a supported policy", () => {
    const sources: EarningsSource[] = [{ assetCode: "USDC", assetIssuer: null, paymentCount: 2 }];
    expect(validateSourceSelection(["pay-1", "pay-2"], sources, "SUM")).toBeNull();
  });
});

describe("formatAggregationPolicy", () => {
  it("formats SUM using its display label", () => {
    expect(formatAggregationPolicy("SUM")).toBe("Sum");
  });
});
