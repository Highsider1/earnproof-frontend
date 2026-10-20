import { z } from "zod";

export const createEmployerPaymentProofSchema = z
  .object({
    sourceAddress: z.string().min(1, "An employer source must be selected"),
    periodStart: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
    periodEnd: z
      .string()
      .refine((date) => !isNaN(Date.parse(date)), "Invalid end date"),
    assetCode: z.string().min(1, "Asset code is required"),
    assetIssuer: z.string().optional(),
    expiresInDays: z
      .number()
      .int()
      .min(1, "Expiry must be at least 1 day")
      .max(365, "Expiry cannot exceed 365 days")
      .optional(),
  })
  .refine(
    (data) => new Date(data.periodStart) < new Date(data.periodEnd),
    {
      message: "Period end must be after period start",
      path: ["periodEnd"],
    }
  );

export type CreateEmployerPaymentProofInput = z.infer<typeof createEmployerPaymentProofSchema>;

export const WIZARD_STEPS = {
  PERIOD_CONFIG: "period-config",
  SOURCE_SELECTION: "source-selection",
  CONFIRMATION: "confirmation",
} as const;

export type WizardStep = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];

export const STEP_LABELS: Record<WizardStep, string> = {
  [WIZARD_STEPS.PERIOD_CONFIG]: "Period Configuration",
  [WIZARD_STEPS.SOURCE_SELECTION]: "Employer Source",
  [WIZARD_STEPS.CONFIRMATION]: "Confirmation",
};

export const DEFAULT_VALUES = {
  expiresInDays: 90,
} as const;
