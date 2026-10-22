import {
  createBackfillRequestSchema,
  rangesOverlap,
  estimatedScopeDays,
  MAX_BACKFILL_RANGE_DAYS,
} from "../payment-backfill";

const NOW = "2026-06-15T00:00:00.000Z";

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date(NOW));
});

afterEach(() => {
  jest.useRealTimers();
});

describe("createBackfillRequestSchema", () => {
  it("accepts a valid, bounded past range", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-06-01T00:00:00.000Z",
      rangeEnd: "2026-06-10T00:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an end date before the start date (negative case)", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-06-10T00:00:00.000Z",
      rangeEnd: "2026-06-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an equal start and end date", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-06-01T00:00:00.000Z",
      rangeEnd: "2026-06-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it(`accepts a range exactly at the ${MAX_BACKFILL_RANGE_DAYS}-day cap (boundary case)`, () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-03-01T00:00:00.000Z",
      rangeEnd: "2026-05-30T00:00:00.000Z", // 90 days later
    });
    expect(result.success).toBe(true);
  });

  it("rejects a range one day over the cap (boundary case)", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-03-01T00:00:00.000Z",
      rangeEnd: "2026-05-31T00:00:00.000Z", // 91 days later
    });
    expect(result.success).toBe(false);
  });

  it("rejects a range ending in the future", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-06-01T00:00:00.000Z",
      rangeEnd: "2026-06-20T00:00:00.000Z", // after NOW (2026-06-15)
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unparsable start date", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "not-a-date",
      rangeEnd: "2026-06-10T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unparsable end date", () => {
    const result = createBackfillRequestSchema.safeParse({
      rangeStart: "2026-06-01T00:00:00.000Z",
      rangeEnd: "not-a-date",
    });
    expect(result.success).toBe(false);
  });
});

describe("rangesOverlap", () => {
  it("detects an overlapping range", () => {
    const a = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-10T00:00:00.000Z" };
    const b = { rangeStart: "2026-06-05T00:00:00.000Z", rangeEnd: "2026-06-15T00:00:00.000Z" };
    expect(rangesOverlap(a, b)).toBe(true);
  });

  it("returns false for adjacent, non-overlapping ranges", () => {
    const a = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-10T00:00:00.000Z" };
    const b = { rangeStart: "2026-06-10T00:00:00.000Z", rangeEnd: "2026-06-20T00:00:00.000Z" };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it("returns false for clearly separate ranges", () => {
    const a = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-05T00:00:00.000Z" };
    const b = { rangeStart: "2026-06-10T00:00:00.000Z", rangeEnd: "2026-06-15T00:00:00.000Z" };
    expect(rangesOverlap(a, b)).toBe(false);
  });

  it("detects a range fully contained within another", () => {
    const a = { rangeStart: "2026-06-01T00:00:00.000Z", rangeEnd: "2026-06-20T00:00:00.000Z" };
    const b = { rangeStart: "2026-06-05T00:00:00.000Z", rangeEnd: "2026-06-10T00:00:00.000Z" };
    expect(rangesOverlap(a, b)).toBe(true);
  });
});

describe("estimatedScopeDays", () => {
  it("computes whole-day span", () => {
    expect(
      estimatedScopeDays("2026-06-01T00:00:00.000Z", "2026-06-10T00:00:00.000Z"),
    ).toBe(9);
  });

  it("returns 0 for an invalid (end before start) range", () => {
    expect(
      estimatedScopeDays("2026-06-10T00:00:00.000Z", "2026-06-01T00:00:00.000Z"),
    ).toBe(0);
  });

  it("returns 0 for unparsable input", () => {
    expect(estimatedScopeDays("garbage", "2026-06-01T00:00:00.000Z")).toBe(0);
  });
});
