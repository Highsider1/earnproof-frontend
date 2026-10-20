/**
 * Minimal Stellar StrKey decoder (ed25519 public keys, "G..." addresses
 * only). There is no Stellar SDK in this project (only
 * @stellar/freighter-api, which never needs to decode a StrKey itself), so
 * this implements just enough of SEP-0023 to turn a signer's "G..." address
 * into the raw 32-byte Ed25519 public key @noble/ed25519's verify() needs -
 * base32 decoding (RFC 4648, unpadded) plus the version byte and CRC16/XModem
 * checksum every StrKey carries.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ED25519_PUBLIC_KEY_VERSION_BYTE = 6 << 3; // 0x30, decodes to a leading "G"

function base32Decode(input: string): Uint8Array | null {
  const cleaned = input.toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) return null;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >> bits) & 0xff);
    }
  }

  // Any leftover bits must be zero padding, never data (a malformed/crafted
  // StrKey could otherwise smuggle extra bits past the byte boundary).
  if (bits >= 5 || (value & ((1 << bits) - 1)) !== 0) {
    return null;
  }

  return new Uint8Array(bytes);
}

/** CRC16/XModem, the checksum algorithm SEP-0023 specifies for StrKey. */
function crc16XModem(bytes: Uint8Array): number {
  let crc = 0;
  for (const byte of bytes) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = (crc & 0x8000) !== 0 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc;
}

/**
 * Decodes a Stellar ed25519-public-key StrKey ("G...") into its raw 32-byte
 * public key, or null if it is not a well-formed one - wrong version byte,
 * bad checksum, wrong length, or invalid base32. Never throws: every caller
 * here is on a signature-verification path where a malformed key must fail
 * closed, not crash.
 */
export function decodeEd25519PublicKey(strKey: string): Uint8Array | null {
  if (!/^G[A-Z2-7]{55}$/.test(strKey)) {
    return null;
  }

  const decoded = base32Decode(strKey);
  if (!decoded || decoded.length !== 35) {
    return null;
  }

  const versionByte = decoded[0];
  const payload = decoded.slice(1, 33);
  const checksum = decoded[33] | (decoded[34] << 8);

  if (versionByte !== ED25519_PUBLIC_KEY_VERSION_BYTE) {
    return null;
  }

  const expectedChecksum = crc16XModem(decoded.slice(0, 33));
  if (checksum !== expectedChecksum) {
    return null;
  }

  return payload;
}
