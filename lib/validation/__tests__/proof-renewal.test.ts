import { checkRenewalEligibility, isCompatibleRenewalType } from "../proof-renewal";
import type { ProofListItem } from "@/lib/api/proofs-list";

function makeProof(overrides: Partial<ProofListItem> = {}): ProofListItem {
  return {
    id: "proof-1",
    type: "MINIMUM_INCOME",
    status: "VALID",
    issuerId: "issuer-1",
    issuerName: "Acme Issuer",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    revokedAt: null,
    summary: { assetCode: "USDC" },
    ...overrides,
  };
}

describe("checkRenewalEligibility", () => {
  it("allows renewal of a valid proof by its own issuer", () => {
    const proof = makeProof();
    expect(checkRenewalEligibility(proof, "issuer-1")).toEqual({ eligible: true });
  });

  it("blocks renewal of a revoked proof (negative case)", () => {
    const proof = makeProof({ status: "REVOKED", revokedAt: "2026-01-15T00:00:00.000Z" });
    const result = checkRenewalEligibility(proof, "issuer-1");
    expect(result.eligible).toBe(false);
  });

  it("blocks renewal by a caller that is not the issuing owner (authorization case)", () => {
    const proof = makeProof({ issuerId: "issuer-1" });
    const result = checkRenewalEligibility(proof, "issuer-2");
    expect(result.eligible).toBe(false);
  });

  it("blocks renewal of an expired-but-not-revoked proof only if actually revoked, not merely expired", () => {
    // Expiry alone is exactly the case renewal exists to solve — an
    // expired (not revoked) proof must remain renewable.
    const proof = makeProof({ status: "EXPIRED" });
    expect(checkRenewalEligibility(proof, "issuer-1")).toEqual({ eligible: true });
  });

  it("gives a specific reason string for each rejection", () => {
    const revoked = makeProof({ status: "REVOKED", revokedAt: "2026-01-15T00:00:00.000Z" });
    const result = checkRenewalEligibility(revoked, "issuer-1");
    if (!result.eligible) {
      expect(result.reason).toMatch(/revoked/i);
    } else {
      throw new Error("expected ineligible result");
    }
  });
});

describe("isCompatibleRenewalType", () => {
  it("allows renewing into the same proof type", () => {
    expect(isCompatibleRenewalType("MINIMUM_INCOME", "MINIMUM_INCOME")).toBe(true);
  });

  it("blocks renewing into a different proof type (incompatible-type case)", () => {
    expect(isCompatibleRenewalType("MINIMUM_INCOME", "PAYMENT_RECEIPT")).toBe(false);
  });

  it("blocks every cross-type combination", () => {
    expect(isCompatibleRenewalType("PAYMENT_RECEIPT", "RECURRING_INCOME")).toBe(false);
    expect(isCompatibleRenewalType("RECURRING_INCOME", "MINIMUM_INCOME")).toBe(false);
  });
});
