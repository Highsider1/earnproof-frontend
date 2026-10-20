/**
 * Asset-aware amount formatting and validation.
 *
 * Stellar amounts are always fixed to 7 decimal places (STELLAR_ASSET_DECIMALS
 * in lib/stellar/asset.ts), for both the native asset and issued assets.
 * That fixed precision makes this a bounded problem rather than
 * general-purpose arbitrary-precision math: every amount is parsed once
 * into an exact integer of "stroops" (amount * 10^7) as a BigInt, all
 * arithmetic happens on that integer, and formatting converts back to a
 * decimal string only at the end. A `number` is never used to hold or
 * compute an amount anywhere in this module, since a JS `number` cannot
 * represent every 7-decimal Stellar amount exactly (e.g. 0.1 + 0.2 !== 0.3
 * in floating point), which is exactly the class of bug this exists to
 * rule out.
 *
 * Formatting large/small values through Intl.NumberFormat is done on the
 * integer and fractional parts of the stroop count independently (grouping
 * the integer part, then reattaching the exact fractional digits as text),
 * rather than by calling toLocaleString on a parsed float, so precision is
 * never round-tripped through a float at any point.
 */

import { DEFAULT_LOCALE } from "./locale";
import { STELLAR_ASSET_DECIMALS, type StellarAsset } from "@/lib/stellar/asset";

const SCALE = 10n ** BigInt(STELLAR_ASSET_DECIMALS);

/** A decimal string made only of an optional sign, digits, and at most one '.'. */
const DECIMAL_STRING_PATTERN = /^(-?)(\d+)(?:\.(\d+))?$/;

export type ParsedAmount =
  | { ok: true; stroops: bigint }
  | { ok: false; reason: "malformed" | "precision-exceeded" | "negative" };

/**
 * Parses a decimal amount string (as returned by the API, e.g.
 * CreateMinimumIncomeProofRequest.thresholdAmount) into an exact integer of
 * stroops. Rejects rather than silently rounds anything with more than
 * STELLAR_ASSET_DECIMALS fractional digits ("Unsupported precision is
 * rejected rather than silently rounded", per this issue's acceptance
 * criteria) and rejects negative amounts (no amount in this app's domain -
 * a proof threshold, a payment amount - is ever negative).
 */
export function parseAssetAmount(value: string): ParsedAmount {
  const trimmed = value.trim();
  const match = DECIMAL_STRING_PATTERN.exec(trimmed);
  if (!match) {
    return { ok: false, reason: "malformed" };
  }

  const [, sign, wholePart, fractionPart = ""] = match;
  if (sign === "-") {
    return { ok: false, reason: "negative" };
  }
  if (fractionPart.length > STELLAR_ASSET_DECIMALS) {
    return { ok: false, reason: "precision-exceeded" };
  }

  const paddedFraction = fractionPart.padEnd(STELLAR_ASSET_DECIMALS, "0");
  const stroops = BigInt(wholePart) * SCALE + BigInt(paddedFraction || "0");
  return { ok: true, stroops };
}

/**
 * Formats an exact stroop count back to a decimal string, e.g. 1_2345678n
 * with the default options -> "1.2345678". Trailing fractional zeros are
 * dropped by default (matching how amounts are conventionally displayed),
 * unless `minimumFractionDigits` says otherwise.
 */
export function formatStroops(
  stroops: bigint,
  options: { minimumFractionDigits?: number; locale?: string } = {},
): string {
  const { minimumFractionDigits = 0, locale = DEFAULT_LOCALE } = options;
  const negative = stroops < 0n;
  const magnitude = negative ? -stroops : stroops;

  const wholePart = magnitude / SCALE;
  const fractionPart = magnitude % SCALE;

  let fractionDigits = fractionPart.toString().padStart(STELLAR_ASSET_DECIMALS, "0");
  // Drop trailing zeros down to minimumFractionDigits, never below it.
  while (fractionDigits.length > minimumFractionDigits && fractionDigits.endsWith("0")) {
    fractionDigits = fractionDigits.slice(0, -1);
  }

  const groupedWhole = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(
    wholePart,
  );
  const sign = negative ? "-" : "";
  return fractionDigits.length > 0 ? `${sign}${groupedWhole}.${fractionDigits}` : `${sign}${groupedWhole}`;
}

export type FormatAssetAmountResult =
  | { ok: true; formatted: string }
  | { ok: false; reason: "malformed" | "precision-exceeded" | "negative" };

/**
 * Parses and formats a decimal amount string for display alongside its
 * asset, distinguishing native and issued assets in the label (#174's
 * "Native and issued assets are distinguishable" criterion). An invalid
 * amount is reported rather than silently coerced to something displayable.
 */
export function formatAssetAmount(
  value: string,
  asset: StellarAsset,
  options: { minimumFractionDigits?: number; locale?: string } = {},
): FormatAssetAmountResult {
  const parsed = parseAssetAmount(value);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  const amount = formatStroops(parsed.stroops, options);
  return { ok: true, formatted: `${amount} ${asset.assetCode}` };
}

/**
 * Validates a user-entered amount string against the asset's allowed
 * precision, for use as a form field validator. Returns an error message,
 * or null if the value is acceptable (including empty, which callers
 * typically pair with a separate "required" check).
 */
export function validateAssetAmountInput(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") {
    return null;
  }

  const parsed = parseAssetAmount(trimmed);
  if (!parsed.ok) {
    switch (parsed.reason) {
      case "negative":
        return "Amount cannot be negative.";
      case "precision-exceeded":
        return `Amount cannot have more than ${STELLAR_ASSET_DECIMALS} decimal places.`;
      case "malformed":
      default:
        return "Enter a valid amount, e.g. 12.5.";
    }
  }

  return null;
}
