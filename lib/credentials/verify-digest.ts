/**
 * Integrity verification for downloaded exports (#192).
 *
 * Computes a SHA-256 digest of the exact bytes about to be downloaded using
 * the Web Crypto API (no dependency, no server round-trip needed for a
 * client-generated export). When the server-provided digest metadata this
 * issue describes becomes available on an API response, pass it as
 * `expectedDigest` to verifyDigest() to fail closed on any mismatch.
 *
 * Only SHA-256 is supported today. Any other requested algorithm fails
 * closed (rejected, not silently downgraded to an unverified pass) per the
 * issue's "unsupported algorithms fail closed" acceptance criterion.
 */

export type DigestAlgorithm = "SHA-256";

export const SUPPORTED_DIGEST_ALGORITHMS: readonly DigestAlgorithm[] = ["SHA-256"];

export type DigestVerificationResult =
  | { status: "verified"; digest: string; algorithm: DigestAlgorithm }
  | { status: "mismatch"; digest: string; expectedDigest: string; algorithm: DigestAlgorithm }
  | { status: "unsupported-algorithm"; algorithm: string }
  | { status: "unavailable" };

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** True when SubtleCrypto is present in this environment. */
export function isDigestVerificationAvailable(): boolean {
  return typeof crypto !== "undefined" && Boolean(crypto.subtle?.digest);
}

/**
 * Computes a hex-encoded SHA-256 digest of `bytes`.
 *
 * Uses a single `crypto.subtle.digest` call over the whole buffer rather
 * than chunking/streaming: every export this app produces today (a single
 * JSON credential or a one-line verification link) is small, human-scale
 * text, so a synchronous whole-buffer digest does not block the UI in
 * practice. Revisit with a chunked/Worker-based approach only if a future
 * export type introduces multi-megabyte downloads.
 */
export async function computeSha256Digest(bytes: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return toHex(hashBuffer);
}

/**
 * Verifies that `bytes` matches `expectedDigest` (if provided) under
 * `algorithm`. When no expected digest is supplied (no server metadata yet
 * available), still computes and returns the digest so it can be displayed
 * and copied, but reports "verified" since there is nothing to compare
 * against.
 */
export async function verifyDigest(
  bytes: ArrayBuffer,
  options: { algorithm: string; expectedDigest?: string },
): Promise<DigestVerificationResult> {
  if (!isDigestVerificationAvailable()) {
    return { status: "unavailable" };
  }

  if (!SUPPORTED_DIGEST_ALGORITHMS.includes(options.algorithm as DigestAlgorithm)) {
    return { status: "unsupported-algorithm", algorithm: options.algorithm };
  }

  const algorithm = options.algorithm as DigestAlgorithm;
  const digest = await computeSha256Digest(bytes);

  if (options.expectedDigest && options.expectedDigest.toLowerCase() !== digest.toLowerCase()) {
    return { status: "mismatch", digest, expectedDigest: options.expectedDigest, algorithm };
  }

  return { status: "verified", digest, algorithm };
}
