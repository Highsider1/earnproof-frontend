import { z } from "zod";
import type { AggregationPolicy } from "@/lib/api/aggregate-earnings-proofs";

export const aggregationPolicySchema = z.enum(["SUM"]);

export const createAggregateEarningsProofSchema = z
  .object({
    selectedPaymentIds: z.array(z.string()).min(1, "At least one payment must be selected"),
    aggregationPolicy: aggregationPolicySchema,
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
  .refine(
    (data) => new Date(data.periodStart) < new Date(data.periodEnd),
    { message: "Period end must be after period start", path: ["periodEnd"] }
  );

export type CreateAggregateEarningsProofInput = z.infer<typeof createAggregateEarningsProofSchema>;

export const WIZARD_STEPS = {
  SOURCE_SELECTION: "source-selection",
  DISCLOSURE_PREVIEW: "disclosure-preview",
  CONFIRMATION: "confirmation",
} as const;

export type WizardStep = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];

export const STEP_ORDER: WizardStep[] = [
  WIZARD_STEPS.SOURCE_SELECTION,
  WIZARD_STEPS.DISCLOSURE_PREVIEW,
  WIZARD_STEPS.CONFIRMATION,
];

export const STEP_LABELS: Record<WizardStep, string> = {
  [WIZARD_STEPS.SOURCE_SELECTION]: "Source Selection",
  [WIZARD_STEPS.DISCLOSURE_PREVIEW]: "Disclosure Preview",
  [WIZARD_STEPS.CONFIRMATION]: "Confirmation",
};

export const DEFAULT_VALUES = {
  aggregationPolicy: "SUM" as AggregationPolicy,
  expiresInDays: 90,
} as const;
