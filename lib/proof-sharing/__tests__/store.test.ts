import { createShareLink, revokeShareLink, listShareLinks, AlreadyRevokedError } from "../store";

describe("proof-sharing store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates a link and returns a raw token separate from the persisted record", async () => {
    const { token, record } = await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    expect(token).toHaveLength(48);
    expect(record.tokenHash).not.toBe(token);
    expect(record.tokenHash).toHaveLength(8);
  });

  it("never persists the raw token anywhere in localStorage", async () => {
    const { token } = await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    const raw = window.localStorage.getItem("earnproof.proof-share-links.user-1");
    expect(raw).not.toContain(token);
  });

  it("lists links scoped to a proof with computed ACTIVE status", async () => {
    await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    const links = listShareLinks("user-1", "proof-1");
    expect(links).toHaveLength(1);
    expect(links[0].status).toBe("ACTIVE");
  });

  it("does not list links for a different proof", async () => {
    await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    expect(listShareLinks("user-1", "proof-2")).toEqual([]);
  });

  it("scopes links per user", async () => {
    await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    expect(listShareLinks("user-2", "proof-1")).toEqual([]);
  });

  it("computes EXPIRED status for a link past its expiry", async () => {
    const { record } = await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 1,
      discloseAmount: false,
      discloseSender: false,
    });

    const links = listShareLinks("user-1", "proof-1", Date.now() + 2 * 60 * 60 * 1000);
    expect(links.find((link) => link.id === record.id)?.status).toBe("EXPIRED");
  });

  it("revokes an active link and marks it REVOKED", async () => {
    const { record } = await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    revokeShareLink("user-1", record.id);

    const links = listShareLinks("user-1", "proof-1");
    expect(links[0].status).toBe("REVOKED");
  });

  it("throws AlreadyRevokedError when revoking a link twice", async () => {
    const { record } = await createShareLink("user-1", {
      proofId: "proof-1",
      expiresInHours: 24,
      discloseAmount: false,
      discloseSender: false,
    });

    revokeShareLink("user-1", record.id);
    expect(() => revokeShareLink("user-1", record.id)).toThrow(AlreadyRevokedError);
  });

  it("throws for revoking a link that does not exist", () => {
    expect(() => revokeShareLink("user-1", "nonexistent")).toThrow(/not found/i);
  });

  it("recovers gracefully from corrupted stored data", () => {
    window.localStorage.setItem("earnproof.proof-share-links.user-1", "not-json");
    expect(listShareLinks("user-1", "proof-1")).toEqual([]);
  });
});
