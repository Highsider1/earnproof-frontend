import { z } from "zod";

/**
 * Normalizes a raw, user-entered invoice reference for local matching only:
 * trims, uppercases, and strips everything but alphanumerics and hyphens.
 * The raw (un-normalized) value the user typed must never be logged,
 * persisted, or placed in a URL (#165's "raw invoice references are not
 * logged, persisted, or added to URLs") — only this normalized form, or
 * nothing at all, is ever passed along.
 */
export function normalizeInvoiceReference(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

export const invoiceReferenceSchema = z
  .string()
  .min(4, "Invoice reference is too short")
  .max(64, "Invoice reference is too long")
  .refine((value) => normalizeInvoiceReference(value).length >= 4, {
    message: "Invoice reference must contain at least 4 letters, numbers, or hyphens",
  });

export type SettlementMatchOutcome =
  | { kind: "MATCHED"; paymentId: string }
  | { kind: "AMBIGUOUS"; candidateCount: number }
  | { kind: "NO_MATCH" }
  | { kind: "UNSUPPORTED_ASSET"; assetCode: string }
  | { kind: "ALREADY_BOUND_ELSEWHERE" };

/**
 * Finds candidate payments a settlement could bind to: eligible income
 * payments in a supported asset that are not already bound to a different
 * invoice reference. More than one candidate is AMBIGUOUS (the wizard
 * cannot guess which payment the reference belongs to); a candidate whose
 * asset isn't supported never reaches this pool in the first place, so
 * UNSUPPORTED_ASSET is reported separately when every eligible payment for
 * this reference falls outside SUPPORTED_ASSET_CODES.
 */
export function classifySettlementMatch(
  candidates: Array<{ paymentId: string; assetCode: string; alreadyBoundElsewhere: boolean }>,
): SettlementMatchOutcome {
  const supported = candidates.filter((candidate) => isSupportedAssetCode(candidate.assetCode));
  const availableSupported = supported.filter((candidate) => !candidate.alreadyBoundElsewhere);

  if (candidates.length === 0) {
    return { kind: "NO_MATCH" };
  }

  if (supported.length === 0) {
    return { kind: "UNSUPPORTED_ASSET", assetCode: candidates[0].assetCode };
  }

  if (availableSupported.length === 0) {
    return { kind: "ALREADY_BOUND_ELSEWHERE" };
  }

  if (availableSupported.length > 1) {
    return { kind: "AMBIGUOUS", candidateCount: availableSupported.length };
  }

  return { kind: "MATCHED", paymentId: availableSupported[0].paymentId };
}

export const createInvoiceSettlementProofSchema = z.object({
  paymentId: z.string().min(1, "A matching settlement is required"),
  normalizedInvoiceReference: z.string().min(4, "Invoice reference is required"),
  expiresInDays: z
    .number()
    .int()
    .min(1, "Expiry must be at least 1 day")
    .max(365, "Expiry cannot exceed 365 days")
    .optional(),
});

export type CreateInvoiceSettlementProofInput = z.infer<typeof createInvoiceSettlementProofSchema>;

export const WIZARD_STEPS = {
  REFERENCE_ENTRY: "reference-entry",
  SETTLEMENT_MATCH: "settlement-match",
  CONFIRMATION: "confirmation",
} as const;

export type WizardStep = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];

export const STEP_LABELS: Record<WizardStep, string> = {
  [WIZARD_STEPS.REFERENCE_ENTRY]: "Invoice Reference",
  [WIZARD_STEPS.SETTLEMENT_MATCH]: "Settlement Match",
  [WIZARD_STEPS.CONFIRMATION]: "Confirmation",
};

export const STEP_ORDER: WizardStep[] = [
  WIZARD_STEPS.REFERENCE_ENTRY,
  WIZARD_STEPS.SETTLEMENT_MATCH,
  WIZARD_STEPS.CONFIRMATION,
];

export const DEFAULT_VALUES = {
  expiresInDays: 90,
} as const;

export const SUPPORTED_ASSET_CODES = ["USDC", "EURC", "XLM"] as const;

export function isSupportedAssetCode(assetCode: string): boolean {
  return (SUPPORTED_ASSET_CODES as readonly string[]).includes(assetCode);
}
