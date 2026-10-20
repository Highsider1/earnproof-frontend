import {
  buildMinimumIncomeProofPayload,
  DEFAULT_PROOF_EXPIRES_IN_DAYS,
} from "@/lib/proofs/minimum-income-payload";
import type { ProofIntent } from "@/lib/proofs/idempotency";

const intent: ProofIntent = {
  selectedPaymentIds: ["pay_1", "pay_2"],
  thresholdAmount: "100",
  assetCode: "USDC",
  assetIssuer: "GISSUER1",
  periodStart: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-08-31T23:59:59.000Z",
};

describe("buildMinimumIncomeProofPayload", () => {
  it("includes every field of the intent unchanged", () => {
    const payload = buildMinimumIncomeProofPayload(intent);
    expect(payload.selectedPaymentIds).toEqual(intent.selectedPaymentIds);
    expect(payload.thresholdAmount).toBe(intent.thresholdAmount);
    expect(payload.assetCode).toBe(intent.assetCode);
    expect(payload.assetIssuer).toBe(intent.assetIssuer);
    expect(payload.periodStart).toBe(intent.periodStart);
    expect(payload.periodEnd).toBe(intent.periodEnd);
  });

  it("defaults expiresInDays to the documented default", () => {
    const payload = buildMinimumIncomeProofPayload(intent);
    expect(payload.expiresInDays).toBe(DEFAULT_PROOF_EXPIRES_IN_DAYS);
    expect(payload.expiresInDays).toBe(30);
  });

  it("accepts an explicit expiresInDays override", () => {
    const payload = buildMinimumIncomeProofPayload(intent, 7);
    expect(payload.expiresInDays).toBe(7);
  });

  it("produces the same payload for the same intent (deterministic, no hidden state)", () => {
    const first = buildMinimumIncomeProofPayload(intent);
    const second = buildMinimumIncomeProofPayload(intent);
    expect(first).toEqual(second);
  });

  it("omits assetIssuer when the intent has none, rather than sending an empty string", () => {
    const payload = buildMinimumIncomeProofPayload({ ...intent, assetIssuer: undefined });
    expect(payload.assetIssuer).toBeUndefined();
  });
});
