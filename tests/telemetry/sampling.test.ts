/**
 * Sampling boundaries. Asserted exactly, with an injected random source,
 * rather than statistically — a flaky sampling test is worse than none.
 */

import { normalizeRate, resolveSampleRate, shouldSample } from "@/lib/telemetry/sampling";
import type { SamplingConfig } from "@/lib/telemetry/sampling";

const always = () => 0;
const never = () => 0.999999;

describe("normalizeRate", () => {
  it("clamps into [0, 1]", () => {
    expect(normalizeRate(0)).toBe(0);
    expect(normalizeRate(1)).toBe(1);
    expect(normalizeRate(0.25)).toBe(0.25);
    expect(normalizeRate(-1)).toBe(0);
    expect(normalizeRate(7)).toBe(1);
  });

  it("fails closed on anything that is not a finite number", () => {
    expect(normalizeRate(Number.NaN)).toBe(0);
    expect(normalizeRate(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeRate("0.5")).toBe(0);
    expect(normalizeRate(undefined)).toBe(0);
    expect(normalizeRate(null)).toBe(0);
  });
});

describe("shouldSample", () => {
  it("never samples at a rate of 0, whatever the random draw", () => {
    const config: SamplingConfig = { defaultRate: 0 };
    expect(shouldSample("api.server-error", config, always)).toBe(false);
    expect(shouldSample("api.server-error", config, () => 0)).toBe(false);
  });

  it("always samples at a rate of 1, whatever the random draw", () => {
    const config: SamplingConfig = { defaultRate: 1 };
    expect(shouldSample("api.server-error", config, never)).toBe(true);
    expect(shouldSample("api.server-error", config, () => 0.9999999)).toBe(true);
  });

  it("uses a strict `random < rate` boundary", () => {
    const config: SamplingConfig = { defaultRate: 0.5 };
    expect(shouldSample("api.timeout", config, () => 0.499999)).toBe(true);
    expect(shouldSample("api.timeout", config, () => 0.5)).toBe(false);
    expect(shouldSample("api.timeout", config, () => 0.500001)).toBe(false);
  });

  it("applies a per-category override over the default rate", () => {
    const config: SamplingConfig = {
      defaultRate: 0,
      categoryRates: { "wallet.rejected": 1 },
    };
    expect(shouldSample("wallet.rejected", config, never)).toBe(true);
    expect(shouldSample("api.server-error", config, always)).toBe(false);
    expect(resolveSampleRate("wallet.rejected", config)).toBe(1);
    expect(resolveSampleRate("api.server-error", config)).toBe(0);
  });

  it("treats a misconfigured rate as 'do not report', not 'report everything'", () => {
    expect(shouldSample("unknown", { defaultRate: Number.NaN }, always)).toBe(false);
    expect(
      shouldSample("unknown", { defaultRate: 1, categoryRates: { unknown: -0.5 } }, always),
    ).toBe(false);
  });

  it("does not sample when the random source itself is broken", () => {
    expect(shouldSample("unknown", { defaultRate: 0.5 }, () => Number.NaN)).toBe(false);
    expect(
      shouldSample("unknown", { defaultRate: 0.5 }, () => undefined as unknown as number),
    ).toBe(false);
  });
});
