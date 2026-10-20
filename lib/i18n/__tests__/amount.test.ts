import {
  formatAssetAmount,
  formatStroops,
  parseAssetAmount,
  validateAssetAmountInput,
} from "../amount";
import { STELLAR_ASSET_DECIMALS } from "@/lib/stellar/asset";

const NATIVE = { assetCode: "XLM", assetIssuer: null };
const ISSUED = { assetCode: "USDC", assetIssuer: "GISSUER000000000000000000000000000000000000000000000000" };

describe("parseAssetAmount", () => {
  it("parses a whole number", () => {
    expect(parseAssetAmount("100")).toEqual({ ok: true, stroops: 100n * 10n ** 7n });
  });

  it("parses a fractional amount with full precision", () => {
    expect(parseAssetAmount("1.2345678")).toEqual({ ok: true, stroops: 12345678n });
  });

  it("parses a fractional amount with fewer than the max digits", () => {
    expect(parseAssetAmount("1.5")).toEqual({ ok: true, stroops: 15000000n });
  });

  it("parses zero", () => {
    expect(parseAssetAmount("0")).toEqual({ ok: true, stroops: 0n });
  });

  it("rejects more than 7 fractional digits (precision-exceeded, not silently rounded)", () => {
    expect(parseAssetAmount("1.12345678")).toEqual({ ok: false, reason: "precision-exceeded" });
  });

  it("rejects a negative amount", () => {
    expect(parseAssetAmount("-1")).toEqual({ ok: false, reason: "negative" });
  });

  it("rejects malformed input: empty string", () => {
    expect(parseAssetAmount("")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects malformed input: non-numeric text", () => {
    expect(parseAssetAmount("abc")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects malformed input: multiple decimal points", () => {
    expect(parseAssetAmount("1.2.3")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects malformed input: a bare decimal point", () => {
    expect(parseAssetAmount(".")).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects scientific notation (not a supported decimal-string shape)", () => {
    expect(parseAssetAmount("1e10")).toEqual({ ok: false, reason: "malformed" });
  });

  it("retains exact meaning for a very large valid value", () => {
    const huge = "922337203685.4775807"; // near Int64 stroop-count range
    const result = parseAssetAmount(huge);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(formatStroops(result.stroops)).toBe("922,337,203,685.4775807");
    }
  });

  it("retains exact meaning for a very small valid value (a single stroop)", () => {
    expect(parseAssetAmount("0.0000001")).toEqual({ ok: true, stroops: 1n });
  });

  it("does not lose precision the way IEEE754 floats would (0.1 + 0.2 style cases)", () => {
    // If this were computed as floats, 0.1 and 0.2 would not sum to exactly
    // 0.3 in stroop terms; as BigInts scaled by 10^7 they do.
    const a = parseAssetAmount("0.1");
    const b = parseAssetAmount("0.2");
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.stroops + b.stroops).toBe(3000000n);
      expect(formatStroops(a.stroops + b.stroops)).toBe("0.3");
    }
  });
});

describe("formatStroops", () => {
  it("formats a whole number with no fractional part", () => {
    expect(formatStroops(100n * 10n ** 7n)).toBe("100");
  });

  it("formats and groups a large integer part per locale", () => {
    expect(formatStroops(1234567n * 10n ** 7n, { locale: "en-US" })).toBe("1,234,567");
  });

  it("formats a negative amount with the sign preserved", () => {
    expect(formatStroops(-15000000n)).toBe("-1.5");
  });

  it("drops trailing fractional zeros by default", () => {
    expect(formatStroops(15000000n)).toBe("1.5");
  });

  it("pads to minimumFractionDigits when requested", () => {
    expect(formatStroops(15000000n, { minimumFractionDigits: 2 })).toBe("1.50");
  });

  it("does not pad below the exact value's own fractional digits even if shorter than minimumFractionDigits allows more truncation", () => {
    expect(formatStroops(12345678n, { minimumFractionDigits: 2 })).toBe("1.2345678");
  });
});

describe("formatAssetAmount", () => {
  it("formats a native asset amount with its code", () => {
    const result = formatAssetAmount("42.5", NATIVE);
    expect(result).toEqual({ ok: true, formatted: "42.5 XLM" });
  });

  it("formats an issued asset amount with its code", () => {
    const result = formatAssetAmount("1000", ISSUED);
    expect(result).toEqual({ ok: true, formatted: "1,000 USDC" });
  });

  it("reports failure for an invalid amount rather than guessing", () => {
    expect(formatAssetAmount("not-a-number", NATIVE)).toEqual({
      ok: false,
      reason: "malformed",
    });
  });

  it("reports failure for excess precision rather than rounding", () => {
    expect(formatAssetAmount("1.123456789", NATIVE)).toEqual({
      ok: false,
      reason: "precision-exceeded",
    });
  });
});

describe("validateAssetAmountInput", () => {
  it("accepts an empty string (callers pair this with their own required check)", () => {
    expect(validateAssetAmountInput("")).toBeNull();
  });

  it("accepts a valid amount", () => {
    expect(validateAssetAmountInput("12.5")).toBeNull();
  });

  it("accepts an amount at exactly the maximum precision boundary", () => {
    expect(validateAssetAmountInput("1." + "9".repeat(STELLAR_ASSET_DECIMALS))).toBeNull();
  });

  it("rejects an amount one digit past the maximum precision boundary", () => {
    expect(validateAssetAmountInput("1." + "9".repeat(STELLAR_ASSET_DECIMALS + 1))).toMatch(
      /decimal places/,
    );
  });

  it("rejects a negative amount with a clear message", () => {
    expect(validateAssetAmountInput("-5")).toMatch(/negative/);
  });

  it("rejects malformed text with a clear message", () => {
    expect(validateAssetAmountInput("twelve")).toMatch(/valid amount/);
  });

  it("tolerates surrounding whitespace", () => {
    expect(validateAssetAmountInput("  12.5  ")).toBeNull();
  });
});
