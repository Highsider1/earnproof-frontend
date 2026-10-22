import { z } from "zod";
import { MIN_RANGE_WIDTH } from "@/lib/api/income-range-proofs";

export const createIncomeRangeProofSchema = z
  .object({
    selectedPaymentIds: z.array(z.string()).min(1, "At least one payment must be selected"),
    lowerBound: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Lower bound must be a non-negative number"),
    upperBound: z.string().refine((value) => Number.isFinite(Number(value)) && Number(value) >= 0, "Upper bound must be a non-negative number"),
    assetCode: z.string().min(1, "Asset code is required"),
    assetIssuer: z.string().optional(),
    periodStart: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
    periodEnd: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid end date"),
    expiresInDays: z
      .number()
      .int()
      .min(1, "Expiry must be at least 1 day")
      .max(365, "Expiry cannot exceed 365 days")
      .optional(),
  })
  .refine((data) => Number(data.lowerBound) < Number(data.upperBound), {
    message: "Upper bound must be greater than the lower bound",
    path: ["upperBound"],
  })
  .refine((data) => Number(data.upperBound) - Number(data.lowerBound) >= MIN_RANGE_WIDTH, {
    message: `The range must span at least ${MIN_RANGE_WIDTH} to avoid disclosing an exact amount`,
    path: ["upperBound"],
  })
  .refine((data) => new Date(data.periodStart) < new Date(data.periodEnd), {
    message: "Period end must be after period start",
    path: ["periodEnd"],
  });

export type CreateIncomeRangeProofInput = z.infer<typeof createIncomeRangeProofSchema>;

export const WIZARD_STEPS = {
  RANGE_CONFIG: "range-config",
  DISCLOSURE_PREVIEW: "disclosure-preview",
  CONFIRMATION: "confirmation",
} as const;

export type WizardStep = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];

export const STEP_ORDER: WizardStep[] = [
  WIZARD_STEPS.RANGE_CONFIG,
  WIZARD_STEPS.DISCLOSURE_PREVIEW,
  WIZARD_STEPS.CONFIRMATION,
];

export const STEP_LABELS: Record<WizardStep, string> = {
  [WIZARD_STEPS.RANGE_CONFIG]: "Range Configuration",
  [WIZARD_STEPS.DISCLOSURE_PREVIEW]: "Disclosure Preview",
  [WIZARD_STEPS.CONFIRMATION]: "Confirmation",
};

export const DEFAULT_VALUES = {
  expiresInDays: 90,
} as const;
