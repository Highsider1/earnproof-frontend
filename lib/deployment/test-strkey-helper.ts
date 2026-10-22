/**
 * Test-only StrKey encoder, the inverse of lib/stellar/strkey.ts's decoder,
 * so tests can turn a freshly generated @noble/ed25519 keypair's raw public
 * key into a "G..." address without needing a real Stellar SDK or a
 * hardcoded fixture keypair.
 */

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ED25519_PUBLIC_KEY_VERSION_BYTE = 6 << 3;

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

function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      output += BASE32_ALPHABET[(value >> bits) & 0x1f];
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }

  return output;
}

export function encodeEd25519PublicKey(publicKey: Uint8Array): string {
  const versioned = new Uint8Array(33);
  versioned[0] = ED25519_PUBLIC_KEY_VERSION_BYTE;
  versioned.set(publicKey, 1);

  const checksum = crc16XModem(versioned);
  const full = new Uint8Array(35);
  full.set(versioned, 0);
  full[33] = checksum & 0xff;
  full[34] = (checksum >> 8) & 0xff;

  return base32Encode(full);
}
