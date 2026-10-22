import { createShareLinkSchema, computeShareLinkStatus, SHARE_EXPIRY_OPTIONS_HOURS } from "../proof-sharing";

describe("createShareLinkSchema", () => {
  const baseInput = {
    proofId: "proof-1",
    expiresInHours: 24,
    discloseAmount: false,
    discloseSender: false,
  };

  it("accepts a valid input", () => {
    expect(createShareLinkSchema.safeParse(baseInput).success).toBe(true);
  });

  it("accepts every supported expiry option", () => {
    for (const hours of SHARE_EXPIRY_OPTIONS_HOURS) {
      expect(createShareLinkSchema.safeParse({ ...baseInput, expiresInHours: hours }).success).toBe(true);
    }
  });

  it("rejects an unsupported expiry value", () => {
    expect(createShareLinkSchema.safeParse({ ...baseInput, expiresInHours: 999 }).success).toBe(false);
  });

  it("rejects a missing proofId", () => {
    expect(createShareLinkSchema.safeParse({ ...baseInput, proofId: "" }).success).toBe(false);
  });
});

describe("computeShareLinkStatus", () => {
  const now = Date.now();
  const future = new Date(now + 60_000).toISOString();
  const past = new Date(now - 60_000).toISOString();

  it("returns ACTIVE for a non-expired, non-revoked link", () => {
    expect(computeShareLinkStatus(future, null, now)).toBe("ACTIVE");
  });

  it("returns EXPIRED for a link past its expiry", () => {
    expect(computeShareLinkStatus(past, null, now)).toBe("EXPIRED");
  });

  it("returns REVOKED for a revoked link, even if not yet expired", () => {
    expect(computeShareLinkStatus(future, new Date(now).toISOString(), now)).toBe("REVOKED");
  });

  it("prefers REVOKED over EXPIRED when both apply", () => {
    expect(computeShareLinkStatus(past, new Date(now).toISOString(), now)).toBe("REVOKED");
  });

  it("treats the exact expiry instant as expired", () => {
    expect(computeShareLinkStatus(new Date(now).toISOString(), null, now)).toBe("EXPIRED");
  });
});
