import { z } from "zod";

export const gapPolicySchema = z.enum(["NO_GAPS", "SHORT_GAPS", "EXTENDED_GAPS"]);

export type GapPolicy = z.infer<typeof gapPolicySchema>;

export const GAP_POLICY_OPTIONS: Array<{ value: GapPolicy; label: string; description: string; maxGapDays: number }> = [
  { value: "NO_GAPS", label: "No gaps", description: "Every period must have at least one qualifying payment", maxGapDays: 0 },
  { value: "SHORT_GAPS", label: "Short gaps tolerated", description: "Gaps of up to 14 days are tolerated between qualifying payments", maxGapDays: 14 },
  { value: "EXTENDED_GAPS", label: "Extended gaps tolerated", description: "Gaps of up to 45 days are tolerated between qualifying payments", maxGapDays: 45 },
];

export function maxGapDaysForPolicy(policy: GapPolicy): number {
  return GAP_POLICY_OPTIONS.find((option) => option.value === policy)?.maxGapDays ?? 0;
}

export const createEmploymentContinuityProofSchema = z
  .object({
    continuityLengthMonths: z
      .number()
      .int()
      .min(1, "Continuity length must be at least 1 month")
      .max(60, "Continuity length cannot exceed 60 months"),
    gapPolicy: gapPolicySchema,
    periodStart: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid start date"),
    periodEnd: z.string().refine((date) => !isNaN(Date.parse(date)), "Invalid end date"),
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
    { message: "Period end must be after period start", path: ["periodEnd"] },
  );

export type CreateEmploymentContinuityProofInput = z.infer<typeof createEmploymentContinuityProofSchema>;

export const WIZARD_STEPS = {
  CONTINUITY_CONFIG: "continuity-config",
  PERIOD_CONFIG: "period-config",
  COVERAGE_REVIEW: "coverage-review",
  CONFIRMATION: "confirmation",
} as const;

export type WizardStep = (typeof WIZARD_STEPS)[keyof typeof WIZARD_STEPS];

export const STEP_LABELS: Record<WizardStep, string> = {
  [WIZARD_STEPS.CONTINUITY_CONFIG]: "Continuity Configuration",
  [WIZARD_STEPS.PERIOD_CONFIG]: "Period Boundaries",
  [WIZARD_STEPS.COVERAGE_REVIEW]: "Coverage Review",
  [WIZARD_STEPS.CONFIRMATION]: "Confirmation",
};

export const STEP_ORDER: WizardStep[] = [
  WIZARD_STEPS.CONTINUITY_CONFIG,
  WIZARD_STEPS.PERIOD_CONFIG,
  WIZARD_STEPS.COVERAGE_REVIEW,
  WIZARD_STEPS.CONFIRMATION,
];

export const DEFAULT_VALUES = {
  continuityLengthMonths: 3,
  gapPolicy: "SHORT_GAPS" as GapPolicy,
  expiresInDays: 90,
} as const;

/**
 * A "period" here is one calendar month within [periodStart, periodEnd).
 * Splitting by whole months (rather than the continuityLengthMonths span
 * itself) is what lets the coverage review show "which months are missing"
 * per the issue's "identify missing periods before submission" criterion.
 */
export function buildMonthlyPeriods(periodStart: string, periodEnd: string): Array<{ start: string; end: string }> {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    return [];
  }

  const periods: Array<{ start: string; end: string }> = [];
  let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));

  while (cursor < end) {
    const periodStartDate = cursor;
    const periodEndDate = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    periods.push({
      start: periodStartDate.toISOString(),
      end: periodEndDate.toISOString(),
    });
    cursor = periodEndDate;
  }

  return periods;
}
