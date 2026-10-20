import { decodeEd25519PublicKey } from "../strkey";

// Deterministic test vector: payload = bytes 0x00..0x1f, encoded per SEP-0023
// (RFC4648 base32, version byte 0x30 for an ed25519 public key/"G..."
// address, CRC16/XModem over version+payload appended little-endian). Cross-
// checked against an independent reference implementation of the spec
// written separately from lib/stellar/strkey.ts's decoder.
const VALID_STRKEY = "GAAACAQDAQCQMBYIBEFAWDANBYHRAEISCMKBKFQXDAMRUGY4DUPB7JZX";
const VALID_PAYLOAD_HEX = "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f";

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

describe("decodeEd25519PublicKey", () => {
  it("decodes a well-formed StrKey to its raw 32-byte payload", () => {
    const result = decodeEd25519PublicKey(VALID_STRKEY);
    expect(result).not.toBeNull();
    expect(result).toHaveLength(32);
    expect(toHex(result!)).toBe(VALID_PAYLOAD_HEX);
  });

  it("rejects a key one character short", () => {
    expect(decodeEd25519PublicKey(VALID_STRKEY.slice(0, -1))).toBeNull();
  });

  it("rejects a key one character too long", () => {
    expect(decodeEd25519PublicKey(VALID_STRKEY + "A")).toBeNull();
  });

  it("rejects a corrupted checksum (last character flipped)", () => {
    const corrupted = VALID_STRKEY.slice(0, -1) + (VALID_STRKEY.endsWith("X") ? "Y" : "X");
    expect(decodeEd25519PublicKey(corrupted)).toBeNull();
  });

  it("rejects a corrupted payload (a middle character flipped)", () => {
    const chars = VALID_STRKEY.split("");
    chars[10] = chars[10] === "A" ? "B" : "A";
    expect(decodeEd25519PublicKey(chars.join(""))).toBeNull();
  });

  it("rejects a key that doesn't start with G (wrong version byte / muxed or contract address)", () => {
    const wrongPrefix = "M" + VALID_STRKEY.slice(1);
    expect(decodeEd25519PublicKey(wrongPrefix)).toBeNull();
  });

  it("rejects non-base32 characters", () => {
    expect(decodeEd25519PublicKey("G0189!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGH")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(decodeEd25519PublicKey("")).toBeNull();
  });

  it("rejects lowercase input (StrKey is case-sensitive uppercase)", () => {
    expect(decodeEd25519PublicKey(VALID_STRKEY.toLowerCase())).toBeNull();
  });

  it("never throws on malformed input", () => {
    const malformedInputs = ["", "G", "not-a-strkey-at-all", "🔑".repeat(20), "G".repeat(56)];
    for (const input of malformedInputs) {
      expect(() => decodeEd25519PublicKey(input)).not.toThrow();
    }
  });
});
