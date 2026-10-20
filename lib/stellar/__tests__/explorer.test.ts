import { buildTransactionExplorerLink } from "../explorer";

const VALID_HASH = "a".repeat(64);

describe("buildTransactionExplorerLink (#137)", () => {
  it("builds a testnet explorer link for a valid hash", () => {
    const result = buildTransactionExplorerLink("testnet", VALID_HASH);
    expect(result).toEqual({
      ok: true,
      href: `https://stellar.expert/explorer/testnet/tx/${VALID_HASH}`,
    });
  });

  it("builds a public-network explorer link for a valid hash", () => {
    const result = buildTransactionExplorerLink("public", VALID_HASH);
    expect(result).toEqual({
      ok: true,
      href: `https://stellar.expert/explorer/public/tx/${VALID_HASH}`,
    });
  });

  it("normalizes network naming variants (\"Stellar Testnet\", \"TESTNET\", \"mainnet\")", () => {
    expect(buildTransactionExplorerLink("Stellar Testnet", VALID_HASH)).toMatchObject({ ok: true });
    expect(buildTransactionExplorerLink("TESTNET", VALID_HASH)).toMatchObject({ ok: true });
    expect(buildTransactionExplorerLink("Stellar Mainnet", VALID_HASH)).toEqual({
      ok: true,
      href: `https://stellar.expert/explorer/public/tx/${VALID_HASH}`,
    });
  });

  it("rejects an unsupported or unrecognized network", () => {
    expect(buildTransactionExplorerLink("bitcoin", VALID_HASH)).toEqual({
      ok: false,
      reason: "unsupported-network",
    });
    expect(buildTransactionExplorerLink("", VALID_HASH)).toEqual({
      ok: false,
      reason: "unsupported-network",
    });
  });

  it("rejects a hash of the wrong length", () => {
    expect(buildTransactionExplorerLink("testnet", "abc")).toEqual({
      ok: false,
      reason: "malformed-identifier",
    });
    expect(buildTransactionExplorerLink("testnet", "a".repeat(63))).toEqual({
      ok: false,
      reason: "malformed-identifier",
    });
    expect(buildTransactionExplorerLink("testnet", "a".repeat(65))).toEqual({
      ok: false,
      reason: "malformed-identifier",
    });
  });

  it("rejects a hash containing non-hex characters", () => {
    expect(buildTransactionExplorerLink("testnet", "g".repeat(64))).toEqual({
      ok: false,
      reason: "malformed-identifier",
    });
    expect(buildTransactionExplorerLink("testnet", "z".repeat(64))).toEqual({
      ok: false,
      reason: "malformed-identifier",
    });
  });

  it("rejects an attempted path-traversal or injection payload disguised as a hash", () => {
    const payloads = [
      "../../../etc/passwd",
      "<script>alert(1)</script>",
      `${VALID_HASH}/../../evil`,
      `${VALID_HASH}?redirect=https://evil.test`,
      "javascript:alert(1)",
    ];
    for (const payload of payloads) {
      expect(buildTransactionExplorerLink("testnet", payload)).toEqual({
        ok: false,
        reason: "malformed-identifier",
      });
    }
  });

  it("is case-insensitive on the hash (Stellar hex hashes are conventionally lowercase, but accepts uppercase input)", () => {
    const upper = VALID_HASH.toUpperCase();
    const result = buildTransactionExplorerLink("testnet", upper);
    expect(result).toEqual({
      ok: true,
      href: `https://stellar.expert/explorer/testnet/tx/${VALID_HASH}`,
    });
  });

  it("only ever produces an https://stellar.expert href, never any other origin", () => {
    const result = buildTransactionExplorerLink("testnet", VALID_HASH);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(new URL(result.href).origin).toBe("https://stellar.expert");
    }
  });
});
