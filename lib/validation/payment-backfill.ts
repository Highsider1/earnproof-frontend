import { z } from "zod";

/**
 * Upper bound on a single backfill request's span, so a mistaken or
 * malicious request can't ask for years of history in one call (#171's
 * "Invalid, overlapping, or oversized ranges are blocked").
 */
export const MAX_BACKFILL_RANGE_DAYS = 90;

export const createBackfillRequestSchema = z
  .object({
    rangeStart: z
      .string()
      .refine((date) => !Number.isNaN(Date.parse(date)), "Invalid start date"),
    rangeEnd: z
      .string()
      .refine((date) => !Number.isNaN(Date.parse(date)), "Invalid end date"),
  })
  .refine((data) => Date.parse(data.rangeStart) < Date.parse(data.rangeEnd), {
    message: "Range end must be after range start",
    path: ["rangeEnd"],
  })
  .refine(
    (data) => {
      const start = Date.parse(data.rangeStart);
      const end = Date.parse(data.rangeEnd);
      const days = (end - start) / (1000 * 60 * 60 * 24);
      return days <= MAX_BACKFILL_RANGE_DAYS;
    },
    {
      message: `Range cannot exceed ${MAX_BACKFILL_RANGE_DAYS} days`,
      path: ["rangeEnd"],
    },
  )
  .refine((data) => Date.parse(data.rangeEnd) <= Date.now(), {
    message: "Range end cannot be in the future",
    path: ["rangeEnd"],
  });

export type CreateBackfillRequestInput = z.infer<typeof createBackfillRequestSchema>;

export function rangesOverlap(
  a: { rangeStart: string; rangeEnd: string },
  b: { rangeStart: string; rangeEnd: string },
): boolean {
  const aStart = Date.parse(a.rangeStart);
  const aEnd = Date.parse(a.rangeEnd);
  const bStart = Date.parse(b.rangeStart);
  const bEnd = Date.parse(b.rangeEnd);
  return aStart < bEnd && bStart < aEnd;
}

export function estimatedScopeDays(rangeStart: string, rangeEnd: string): number {
  const start = Date.parse(rangeStart);
  const end = Date.parse(rangeEnd);
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return 0;
  return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
}
