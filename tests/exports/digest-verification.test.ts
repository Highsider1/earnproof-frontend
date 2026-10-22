/**
 * @jest-environment jsdom
 */

import {
  computeSha256Digest,
  isDigestVerificationAvailable,
  verifyDigest,
} from "@/lib/credentials/verify-digest";

function bytesOf(text: string): ArrayBuffer {
  return new TextEncoder().encode(text).buffer;
}

describe("verify-digest", () => {
  it("reports digest verification as available in this (jsdom + Web Crypto) environment", () => {
    expect(isDigestVerificationAvailable()).toBe(true);
  });

  it("computes a deterministic SHA-256 hex digest", async () => {
    const digest1 = await computeSha256Digest(bytesOf("hello world"));
    const digest2 = await computeSha256Digest(bytesOf("hello world"));
    expect(digest1).toBe(digest2);
    expect(digest1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces different digests for different content", async () => {
    const digestA = await computeSha256Digest(bytesOf("a"));
    const digestB = await computeSha256Digest(bytesOf("b"));
    expect(digestA).not.toBe(digestB);
  });

  describe("verifyDigest", () => {
    it("verifies when no expected digest is supplied (nothing to compare against)", async () => {
      const result = await verifyDigest(bytesOf("payload"), { algorithm: "SHA-256" });
      expect(result.status).toBe("verified");
    });

    it("verifies when the expected digest matches (valid download)", async () => {
      const digest = await computeSha256Digest(bytesOf("payload"));
      const result = await verifyDigest(bytesOf("payload"), {
        algorithm: "SHA-256",
        expectedDigest: digest,
      });
      expect(result.status).toBe("verified");
    });

    it("matches case-insensitively", async () => {
      const digest = await computeSha256Digest(bytesOf("payload"));
      const result = await verifyDigest(bytesOf("payload"), {
        algorithm: "SHA-256",
        expectedDigest: digest.toUpperCase(),
      });
      expect(result.status).toBe("verified");
    });

    it("reports a mismatch when the bytes don't match the expected digest (truncated/substituted download)", async () => {
      const result = await verifyDigest(bytesOf("actual bytes"), {
        algorithm: "SHA-256",
        expectedDigest: "0".repeat(64),
      });
      expect(result.status).toBe("mismatch");
      if (result.status === "mismatch") {
        expect(result.expectedDigest).toBe("0".repeat(64));
      }
    });

    it("fails closed on an unsupported algorithm rather than skipping verification", async () => {
      const result = await verifyDigest(bytesOf("payload"), {
        algorithm: "MD5",
        expectedDigest: "deadbeef",
      });
      expect(result.status).toBe("unsupported-algorithm");
      if (result.status === "unsupported-algorithm") {
        expect(result.algorithm).toBe("MD5");
      }
    });

    it("reports unavailable when SubtleCrypto is missing, without throwing", async () => {
      const originalCrypto = globalThis.crypto;
      // @ts-expect-error - deliberately simulating an environment without Web Crypto
      delete globalThis.crypto;

      try {
        const result = await verifyDigest(bytesOf("payload"), { algorithm: "SHA-256" });
        expect(result.status).toBe("unavailable");
      } finally {
        globalThis.crypto = originalCrypto;
      }
    });
  });
});
