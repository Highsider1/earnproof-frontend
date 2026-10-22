import {
  createEmploymentContinuityProofSchema,
  buildMonthlyPeriods,
  maxGapDaysForPolicy,
} from "../employment-continuity-proofs";

describe("createEmploymentContinuityProofSchema", () => {
  const baseInput = {
    continuityLengthMonths: 3,
    gapPolicy: "SHORT_GAPS" as const,
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-04-01T00:00:00.000Z",
    assetCode: "USDC",
  };

  it("accepts a valid input", () => {
    const result = createEmploymentContinuityProofSchema.safeParse(baseInput);
    expect(result.success).toBe(true);
  });

  it("rejects continuity length below 1", () => {
    const result = createEmploymentContinuityProofSchema.safeParse({
      ...baseInput,
      continuityLengthMonths: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects continuity length above 60", () => {
    const result = createEmploymentContinuityProofSchema.safeParse({
      ...baseInput,
      continuityLengthMonths: 61,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an inverted period", () => {
    const result = createEmploymentContinuityProofSchema.safeParse({
      ...baseInput,
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-01-01T00:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid gap policy", () => {
    const result = createEmploymentContinuityProofSchema.safeParse({
      ...baseInput,
      gapPolicy: "UNLIMITED",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing asset code", () => {
    const result = createEmploymentContinuityProofSchema.safeParse({
      ...baseInput,
      assetCode: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("maxGapDaysForPolicy", () => {
  it("returns 0 for NO_GAPS", () => {
    expect(maxGapDaysForPolicy("NO_GAPS")).toBe(0);
  });

  it("returns 14 for SHORT_GAPS", () => {
    expect(maxGapDaysForPolicy("SHORT_GAPS")).toBe(14);
  });

  it("returns 45 for EXTENDED_GAPS", () => {
    expect(maxGapDaysForPolicy("EXTENDED_GAPS")).toBe(45);
  });
});

describe("buildMonthlyPeriods", () => {
  it("splits a 3-month span into 3 monthly periods", () => {
    const periods = buildMonthlyPeriods("2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z");
    expect(periods).toHaveLength(3);
    expect(periods[0].start).toBe("2026-01-01T00:00:00.000Z");
    expect(periods[2].end).toBe("2026-04-01T00:00:00.000Z");
  });

  it("returns an empty array for an inverted range", () => {
    expect(buildMonthlyPeriods("2026-04-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toEqual([]);
  });

  it("returns an empty array for invalid dates", () => {
    expect(buildMonthlyPeriods("not-a-date", "2026-01-01T00:00:00.000Z")).toEqual([]);
  });

  it("handles a partial-month span as a single period", () => {
    const periods = buildMonthlyPeriods("2026-01-15T00:00:00.000Z", "2026-01-20T00:00:00.000Z");
    expect(periods).toHaveLength(1);
  });

  it("handles a span crossing a year boundary", () => {
    const periods = buildMonthlyPeriods("2026-11-01T00:00:00.000Z", "2027-02-01T00:00:00.000Z");
    expect(periods).toHaveLength(3);
    expect(periods[1].start).toBe("2026-12-01T00:00:00.000Z");
    expect(periods[2].start).toBe("2027-01-01T00:00:00.000Z");
  });
});
