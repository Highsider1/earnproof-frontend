/**
 * @jest-environment jsdom
 */

import {
  formatAttestationType,
  formatAttestationStatus,
  getAttestationStatusTone,
  getEffectiveAttestationStatus,
  canIssuerCreateAttestations,
  validateSubjectWalletHash,
  type IssuerAttestation,
} from "../issuer-attestations";

function attestation(overrides: Partial<IssuerAttestation> = {}): Pick<
  IssuerAttestation,
  "status" | "expiresAt" | "revokedAt"
> {
  return {
    status: "ACTIVE",
    expiresAt: "2026-12-31T00:00:00.000Z",
    revokedAt: null,
    ...overrides,
  };
}

describe("Issuer Attestation Utilities", () => {
  describe("formatAttestationType", () => {
    it("formats known types", () => {
      expect(formatAttestationType("EMPLOYMENT")).toBe("Employment");
      expect(formatAttestationType("IDENTITY_VERIFICATION")).toBe("Identity Verification");
      expect(formatAttestationType("INCOME_SOURCE")).toBe("Income Source");
    });
  });

  describe("formatAttestationStatus / getAttestationStatusTone", () => {
    it("formats and tones known statuses", () => {
      expect(formatAttestationStatus("ACTIVE")).toBe("Active");
      expect(getAttestationStatusTone("ACTIVE")).toBe("success");
      expect(formatAttestationStatus("EXPIRED")).toBe("Expired");
      expect(getAttestationStatusTone("EXPIRED")).toBe("warning");
      expect(formatAttestationStatus("REVOKED")).toBe("Revoked");
      expect(getAttestationStatusTone("REVOKED")).toBe("warning");
    });
  });

  describe("getEffectiveAttestationStatus", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");

    it("returns ACTIVE for a non-expired, non-revoked attestation", () => {
      const result = getEffectiveAttestationStatus(
        attestation({ status: "ACTIVE", expiresAt: "2026-12-31T00:00:00.000Z" }),
        now
      );
      expect(result).toBe("ACTIVE");
    });

    it("treats a past expiresAt as EXPIRED even if status hasn't caught up", () => {
      const result = getEffectiveAttestationStatus(
        attestation({ status: "ACTIVE", expiresAt: "2026-01-01T00:00:00.000Z" }),
        now
      );
      expect(result).toBe("EXPIRED");
    });

    it("treats an attestation expiring exactly now as EXPIRED", () => {
      const result = getEffectiveAttestationStatus(
        attestation({ status: "ACTIVE", expiresAt: now.toISOString() }),
        now
      );
      expect(result).toBe("EXPIRED");
    });

    it("prioritizes REVOKED over expiry", () => {
      const result = getEffectiveAttestationStatus(
        attestation({
          status: "REVOKED",
          expiresAt: "2026-12-31T00:00:00.000Z",
          revokedAt: "2026-05-01T00:00:00.000Z",
        }),
        now
      );
      expect(result).toBe("REVOKED");
    });

    it("treats a revokedAt timestamp as revoked even if status field lags", () => {
      const result = getEffectiveAttestationStatus(
        attestation({ status: "ACTIVE", revokedAt: "2026-05-01T00:00:00.000Z" }),
        now
      );
      expect(result).toBe("REVOKED");
    });
  });

  describe("canIssuerCreateAttestations", () => {
    it("allows only ACTIVE issuers", () => {
      expect(canIssuerCreateAttestations("ACTIVE")).toBe(true);
      expect(canIssuerCreateAttestations("PENDING")).toBe(false);
      expect(canIssuerCreateAttestations("SUSPENDED")).toBe(false);
      expect(canIssuerCreateAttestations("REVOKED")).toBe(false);
    });
  });

  describe("validateSubjectWalletHash", () => {
    it("accepts a valid sha256 wallet hash", () => {
      expect(
        validateSubjectWalletHash(`sha256:${"a".repeat(64)}`)
      ).toBeNull();
    });

    it("requires a non-empty value", () => {
      expect(validateSubjectWalletHash("")).toBe("Subject wallet hash is required");
      expect(validateSubjectWalletHash("   ")).toBe("Subject wallet hash is required");
    });

    it("rejects a hash of the wrong length", () => {
      expect(validateSubjectWalletHash("sha256:abc")).toBe(
        "Enter a valid wallet hash (sha256:<64 hex characters>)"
      );
    });

    it("rejects a value missing the sha256 prefix", () => {
      expect(validateSubjectWalletHash("a".repeat(64))).toBe(
        "Enter a valid wallet hash (sha256:<64 hex characters>)"
      );
    });

    it("rejects non-hex characters", () => {
      expect(validateSubjectWalletHash(`sha256:${"z".repeat(64)}`)).toBe(
        "Enter a valid wallet hash (sha256:<64 hex characters>)"
      );
    });
  });
});
