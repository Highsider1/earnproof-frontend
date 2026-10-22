import { createEmploymentContinuityProof, listEmploymentContinuityProofs } from "../store";

describe("employment-continuity store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  const baseInput = {
    continuityLengthMonths: 3,
    gapPolicy: "SHORT_GAPS" as const,
    periodStart: "2026-01-01T00:00:00.000Z",
    periodEnd: "2026-04-01T00:00:00.000Z",
    assetCode: "USDC",
    assetIssuer: null,
    totalPeriods: 3,
    coveredPeriods: 2,
    missingPeriods: [{ start: "2026-03-01T00:00:00.000Z", end: "2026-04-01T00:00:00.000Z" }],
    expiresInDays: 90,
  };

  it("creates a proof and returns it with generated id and timestamps", () => {
    const proof = createEmploymentContinuityProof("user-1", baseInput);
    expect(proof.id).toMatch(/^employment-continuity-/);
    expect(proof.userId).toBe("user-1");
    expect(proof.createdAt).toBeTruthy();
    expect(new Date(proof.expiresAt).getTime()).toBeGreaterThan(new Date(proof.createdAt).getTime());
  });

  it("persists the proof so it can be listed back", () => {
    const proof = createEmploymentContinuityProof("user-1", baseInput);
    const listed = listEmploymentContinuityProofs("user-1");
    expect(listed).toHaveLength(1);
    expect(listed[0].id).toBe(proof.id);
  });

  it("scopes proofs per user", () => {
    createEmploymentContinuityProof("user-1", baseInput);
    createEmploymentContinuityProof("user-2", baseInput);

    expect(listEmploymentContinuityProofs("user-1")).toHaveLength(1);
    expect(listEmploymentContinuityProofs("user-2")).toHaveLength(1);
  });

  it("returns an empty array for a user with no proofs", () => {
    expect(listEmploymentContinuityProofs("nobody")).toEqual([]);
  });

  it("accumulates multiple proofs for the same user", () => {
    createEmploymentContinuityProof("user-1", baseInput);
    createEmploymentContinuityProof("user-1", { ...baseInput, assetCode: "EURC" });

    const listed = listEmploymentContinuityProofs("user-1");
    expect(listed).toHaveLength(2);
    expect(listed.map((proof) => proof.assetCode)).toEqual(["USDC", "EURC"]);
  });

  it("recovers gracefully from corrupted stored data", () => {
    window.localStorage.setItem("earnproof.employment-continuity-proofs.user-1", "not-json");
    expect(listEmploymentContinuityProofs("user-1")).toEqual([]);
  });
});
