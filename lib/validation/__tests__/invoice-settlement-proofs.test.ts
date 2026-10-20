import {
  normalizeInvoiceReference,
  invoiceReferenceSchema,
  classifySettlementMatch,
  isSupportedAssetCode,
  createInvoiceSettlementProofSchema,
} from "../invoice-settlement-proofs";

describe("normalizeInvoiceReference", () => {
  it("uppercases and strips whitespace", () => {
    expect(normalizeInvoiceReference("  inv-2026-001  ")).toBe("INV-2026-001");
  });

  it("strips characters other than letters, numbers, and hyphens", () => {
    expect(normalizeInvoiceReference("INV#2026/001!")).toBe("INV2026001");
  });

  it("returns an empty string for an entirely invalid reference", () => {
    expect(normalizeInvoiceReference("@@@")).toBe("");
  });
});

describe("invoiceReferenceSchema", () => {
  it("accepts a reasonable reference", () => {
    expect(invoiceReferenceSchema.safeParse("INV-2026-001").success).toBe(true);
  });

  it("rejects a too-short reference", () => {
    expect(invoiceReferenceSchema.safeParse("AB").success).toBe(false);
  });

  it("rejects a reference that normalizes to fewer than 4 characters", () => {
    expect(invoiceReferenceSchema.safeParse("##!!").success).toBe(false);
  });

  it("rejects a reference over 64 characters", () => {
    expect(invoiceReferenceSchema.safeParse("A".repeat(65)).success).toBe(false);
  });
});

describe("isSupportedAssetCode", () => {
  it("returns true for a supported asset", () => {
    expect(isSupportedAssetCode("USDC")).toBe(true);
  });

  it("returns false for an unsupported asset", () => {
    expect(isSupportedAssetCode("SHIB")).toBe(false);
  });
});

describe("classifySettlementMatch", () => {
  it("returns NO_MATCH when there are no candidates", () => {
    expect(classifySettlementMatch([])).toEqual({ kind: "NO_MATCH" });
  });

  it("returns MATCHED for exactly one supported, unbound candidate", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "USDC", alreadyBoundElsewhere: false },
    ]);
    expect(result).toEqual({ kind: "MATCHED", paymentId: "pay-1" });
  });

  it("returns AMBIGUOUS for multiple supported, unbound candidates", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "USDC", alreadyBoundElsewhere: false },
      { paymentId: "pay-2", assetCode: "USDC", alreadyBoundElsewhere: false },
    ]);
    expect(result).toEqual({ kind: "AMBIGUOUS", candidateCount: 2 });
  });

  it("returns UNSUPPORTED_ASSET when no candidate uses a supported asset", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "SHIB", alreadyBoundElsewhere: false },
    ]);
    expect(result).toEqual({ kind: "UNSUPPORTED_ASSET", assetCode: "SHIB" });
  });

  it("returns ALREADY_BOUND_ELSEWHERE when the only supported candidate is already bound", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "USDC", alreadyBoundElsewhere: true },
    ]);
    expect(result).toEqual({ kind: "ALREADY_BOUND_ELSEWHERE" });
  });

  it("ignores unsupported candidates when picking among supported ones", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "SHIB", alreadyBoundElsewhere: false },
      { paymentId: "pay-2", assetCode: "USDC", alreadyBoundElsewhere: false },
    ]);
    expect(result).toEqual({ kind: "MATCHED", paymentId: "pay-2" });
  });

  it("excludes an already-bound candidate but still matches a remaining one", () => {
    const result = classifySettlementMatch([
      { paymentId: "pay-1", assetCode: "USDC", alreadyBoundElsewhere: true },
      { paymentId: "pay-2", assetCode: "USDC", alreadyBoundElsewhere: false },
    ]);
    expect(result).toEqual({ kind: "MATCHED", paymentId: "pay-2" });
  });
});

describe("createInvoiceSettlementProofSchema", () => {
  it("accepts a valid input", () => {
    const result = createInvoiceSettlementProofSchema.safeParse({
      paymentId: "pay-1",
      normalizedInvoiceReference: "INV-2026-001",
      expiresInDays: 90,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a missing paymentId", () => {
    const result = createInvoiceSettlementProofSchema.safeParse({
      paymentId: "",
      normalizedInvoiceReference: "INV-2026-001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an expiry over 365 days", () => {
    const result = createInvoiceSettlementProofSchema.safeParse({
      paymentId: "pay-1",
      normalizedInvoiceReference: "INV-2026-001",
      expiresInDays: 400,
    });
    expect(result.success).toBe(false);
  });
});
