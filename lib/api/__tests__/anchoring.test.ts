/**
 * @jest-environment jsdom
 */

import { isRetryEligible, isReconcileEligible, formatAnchoringStatus, type AnchoringOperation } from "../anchoring";

function operation(overrides: Partial<AnchoringOperation> = {}): AnchoringOperation {
  return {
    id: "op-1",
    proofId: "proof-1",
    status: "PROCESSING",
    attemptCount: 0,
    lastAttemptedAt: null,
    anchoredAt: null,
    failureReason: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("isRetryEligible", () => {
  it("is eligible only for a transient failure", () => {
    expect(isRetryEligible(operation({ status: "FAILED_TRANSIENT" }))).toBe(true);
  });

  it("is not eligible while processing", () => {
    expect(isRetryEligible(operation({ status: "PROCESSING" }))).toBe(false);
  });

  it("is not eligible for a permanent failure", () => {
    expect(isRetryEligible(operation({ status: "FAILED_PERMANENT" }))).toBe(false);
  });

  it("is not eligible once anchored", () => {
    expect(isRetryEligible(operation({ status: "ANCHORED" }))).toBe(false);
  });
});

describe("isReconcileEligible", () => {
  it("is eligible only for a permanent failure", () => {
    expect(isReconcileEligible(operation({ status: "FAILED_PERMANENT" }))).toBe(true);
  });

  it("is not eligible for a transient failure", () => {
    expect(isReconcileEligible(operation({ status: "FAILED_TRANSIENT" }))).toBe(false);
  });

  it("is not eligible while processing", () => {
    expect(isReconcileEligible(operation({ status: "PROCESSING" }))).toBe(false);
  });

  it("is not eligible once anchored", () => {
    expect(isReconcileEligible(operation({ status: "ANCHORED" }))).toBe(false);
  });
});

describe("formatAnchoringStatus", () => {
  it("gives distinct, human-readable labels for transient vs permanent failures", () => {
    const transient = formatAnchoringStatus("FAILED_TRANSIENT");
    const permanent = formatAnchoringStatus("FAILED_PERMANENT");
    expect(transient).not.toBe(permanent);
    expect(transient).toMatch(/retryable/i);
    expect(permanent).toMatch(/permanent/i);
  });
});
