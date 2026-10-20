/**
 * Sampling boundaries for client error telemetry.
 *
 * Sampling exists to bound cost and volume, not to hide failures, so the
 * rules are deliberately blunt and fail *closed*:
 *
 * - A rate of `0` never samples; a rate of `1` always samples.
 * - Anything that is not a finite number in `[0, 1]` — `NaN`, a negative
 *   rate, a rate above 1, a string from a misconfigured env var — is treated
 *   as `0`. A misconfiguration silently disables reporting rather than
 *   silently flooding a collector with user-triggered events.
 * - The boundary is `random < rate`, so `rate = 0` can never sample (the
 *   smallest possible random value is 0) and `rate = 1` always does.
 */

import type { ErrorCategory } from "./schema";

export type SamplingConfig = {
  /** Applied to any category without an explicit override. */
  defaultRate: number;
  /** Per-category overrides, for categories that need full or no capture. */
  categoryRates?: Partial<Record<ErrorCategory, number>>;
};

/** Clamp an untrusted rate into `[0, 1]`, failing closed on anything invalid. */
export function normalizeRate(rate: unknown): number {
  if (typeof rate !== "number" || !Number.isFinite(rate)) return 0;
  if (rate <= 0) return 0;
  if (rate >= 1) return 1;
  return rate;
}

/** The rate that applies to a category after overrides and clamping. */
export function resolveSampleRate(category: ErrorCategory, config: SamplingConfig): number {
  const override = config.categoryRates?.[category];
  return normalizeRate(override === undefined ? config.defaultRate : override);
}

/**
 * Decide whether one event is sampled.
 *
 * `random` is injected so the boundary behaviour is testable exactly rather
 * than statistically; production passes `Math.random`.
 */
export function shouldSample(
  category: ErrorCategory,
  config: SamplingConfig,
  random: () => number = Math.random,
): boolean {
  const rate = resolveSampleRate(category, config);
  if (rate === 0) return false;
  if (rate === 1) return true;

  const value = random();
  // A broken `random` implementation must not turn into "always sample".
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  return value < rate;
}
