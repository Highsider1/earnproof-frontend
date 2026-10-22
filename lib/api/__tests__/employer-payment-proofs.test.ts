/**
 * @jest-environment jsdom
 */

import {
  deriveEmployerSources,
  getSourceMatchStatus,
  truncateSourceAddress,
  validateEmployerPaymentProofRequest,
  type Payment,
} from "../employer-payment-proofs";

const PERIOD_START = "2026-01-01T00:00:00.000Z";
const PERIOD_END = "2026-01-31T23:59:59.000Z";

function payment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "pay-1",
    stellarTransactionHash: "tx-1",
    sourceAddress: "GSOURCE1",
    assetCode: "USDC",
    assetIssuer: null,
    occurredAt: "2026-01-15T00:00:00.000Z",
    classification: "INCOME",
    isEligible: true,
    ...overrides,
  };
}

describe("employer-payment-proofs", () => {
  describe("deriveEmployerSources", () => {
    it("groups payments by source address within the period", () => {
      const payments = [
        payment({ id: "p1", sourceAddress: "GSOURCE1" }),
        payment({ id: "p2", sourceAddress: "GSOURCE1", occurredAt: "2026-01-20T00:00:00.000Z" }),
        payment({ id: "p3", sourceAddress: "GSOURCE2" }),
      ];

      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);

      expect(sources).toHaveLength(2);
      const source1 = sources.find((s) => s.sourceAddress === "GSOURCE1")!;
      expect(source1.paymentCount).toBe(2);
      expect(source1.trust).toBe("TRUSTED");
    });

    it("excludes payments outside the period", () => {
      const payments = [
        payment({ id: "p1", occurredAt: "2025-12-01T00:00:00.000Z" }),
        payment({ id: "p2", occurredAt: "2026-02-15T00:00:00.000Z" }),
      ];

      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources).toHaveLength(0);
    });

    it("marks a source with only eligible, INCOME payments as TRUSTED", () => {
      const payments = [payment({ classification: "INCOME", isEligible: true })];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources[0].trust).toBe("TRUSTED");
    });

    it("marks a source as UNTRUSTED when any payment is ineligible", () => {
      const payments = [
        payment({ id: "p1", isEligible: true }),
        payment({ id: "p2", isEligible: false }),
      ];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources).toHaveLength(1);
      expect(sources[0].trust).toBe("UNTRUSTED");
    });

    it("marks a source as UNTRUSTED when any payment is EXCLUDED", () => {
      const payments = [
        payment({ id: "p1", classification: "INCOME" }),
        payment({ id: "p2", classification: "EXCLUDED" }),
      ];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources[0].trust).toBe("UNTRUSTED");
    });

    it("marks a source as UNTRUSTED when it has no eligible payments at all", () => {
      const payments = [payment({ classification: "PERSONAL_TRANSFER" })];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources[0].trust).toBe("UNTRUSTED");
    });

    it("never exposes individual amounts - only counts and dates", () => {
      const payments = [payment()];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      const keys = Object.keys(sources[0]);
      expect(keys).not.toContain("amount");
      expect(keys).toEqual(
        expect.arrayContaining(["sourceAddress", "trust", "paymentCount", "assetCodes", "firstPaymentAt", "lastPaymentAt"])
      );
    });

    it("collects distinct asset codes per source", () => {
      const payments = [
        payment({ id: "p1", assetCode: "USDC" }),
        payment({ id: "p2", assetCode: "USDC" }),
        payment({ id: "p3", assetCode: "XLM" }),
      ];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(sources[0].assetCodes.sort()).toEqual(["USDC", "XLM"]);
    });
  });

  describe("getSourceMatchStatus", () => {
    it("returns NO_MATCH when there are no trusted sources", () => {
      const sources = deriveEmployerSources(
        [payment({ classification: "EXCLUDED" })],
        PERIOD_START,
        PERIOD_END
      );
      expect(getSourceMatchStatus(sources)).toBe("NO_MATCH");
    });

    it("returns NO_MATCH for an empty source list", () => {
      expect(getSourceMatchStatus([])).toBe("NO_MATCH");
    });

    it("returns SINGLE_MATCH when exactly one trusted source exists", () => {
      const sources = deriveEmployerSources([payment()], PERIOD_START, PERIOD_END);
      expect(getSourceMatchStatus(sources)).toBe("SINGLE_MATCH");
    });

    it("returns MULTIPLE_MATCH when more than one trusted source exists", () => {
      const payments = [
        payment({ id: "p1", sourceAddress: "GSOURCE1" }),
        payment({ id: "p2", sourceAddress: "GSOURCE2" }),
      ];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(getSourceMatchStatus(sources)).toBe("MULTIPLE_MATCH");
    });

    it("ignores untrusted sources when counting matches", () => {
      const payments = [
        payment({ id: "p1", sourceAddress: "GTRUSTED" }),
        payment({ id: "p2", sourceAddress: "GUNTRUSTED", isEligible: false }),
      ];
      const sources = deriveEmployerSources(payments, PERIOD_START, PERIOD_END);
      expect(getSourceMatchStatus(sources)).toBe("SINGLE_MATCH");
    });
  });

  describe("truncateSourceAddress", () => {
    it("leaves short addresses unchanged", () => {
      expect(truncateSourceAddress("GSHORT")).toBe("GSHORT");
    });

    it("truncates long addresses", () => {
      const address = "G" + "A".repeat(55);
      expect(truncateSourceAddress(address)).toBe(`${address.slice(0, 8)}...${address.slice(-8)}`);
    });
  });

  describe("validateEmployerPaymentProofRequest", () => {
    const valid = {
      sourceAddress: "GSOURCE1",
      periodStart: "2026-01-01T00:00:00.000Z",
      periodEnd: "2026-01-31T00:00:00.000Z",
      assetCode: "USDC",
    };

    it("returns null for a valid request", () => {
      expect(validateEmployerPaymentProofRequest(valid)).toBeNull();
    });

    it("requires a source address", () => {
      expect(validateEmployerPaymentProofRequest({ ...valid, sourceAddress: "" })).toBe(
        "An employer source must be selected"
      );
    });

    it("requires period start and end", () => {
      expect(validateEmployerPaymentProofRequest({ ...valid, periodStart: undefined })).toBe(
        "Period start date is required"
      );
      expect(validateEmployerPaymentProofRequest({ ...valid, periodEnd: undefined })).toBe(
        "Period end date is required"
      );
    });

    it("requires period end after period start", () => {
      expect(
        validateEmployerPaymentProofRequest({ ...valid, periodStart: "2026-02-01T00:00:00.000Z" })
      ).toBe("Period end must be after period start");
    });

    it("requires an asset code", () => {
      expect(validateEmployerPaymentProofRequest({ ...valid, assetCode: "" })).toBe(
        "Asset code is required"
      );
    });

    it("validates expiry bounds", () => {
      expect(validateEmployerPaymentProofRequest({ ...valid, expiresInDays: 0 })).toBe(
        "Expiry must be between 1 and 365 days"
      );
      expect(validateEmployerPaymentProofRequest({ ...valid, expiresInDays: 400 })).toBe(
        "Expiry must be between 1 and 365 days"
      );
      expect(validateEmployerPaymentProofRequest({ ...valid, expiresInDays: 90 })).toBeNull();
    });
  });
});
