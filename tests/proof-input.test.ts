import roundTrip from "@/tests/fixtures/qr/round-trip.json";
import malicious from "@/tests/fixtures/qr/malicious.json";
import imageStates from "@/tests/fixtures/qr/image-states.json";
import {
  QR_MAX_PAYLOAD_BYTES,
  QR_PAYLOAD_TYPE,
  QR_PAYLOAD_VERSION,
  generateVerificationQrJson,
  generateVerificationQrPayload,
  parseQrPayload,
  scanDiagnosticToLogLine,
} from "@/lib/validation/qr-payload";
import { extractProofId } from "@/lib/validation/proof-input";

const APP_URL = roundTrip.appUrl;

describe("QR payload contract", () => {
  it("generates only the approved v1 verification URL format", () => {
    for (const size of roundTrip.sizes) {
      const payload = generateVerificationQrPayload({
        appUrl: APP_URL,
        proofId: size.proofId,
      });
      expect(payload).toBe(`${APP_URL}/verify?proof=${encodeURIComponent(size.proofId)}`);
      const parsed = parseQrPayload(payload, APP_URL);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.version).toBe(QR_PAYLOAD_VERSION);
        expect(parsed.proofId).toBe(size.proofId);
        expect(parsed.verifyPath).toBe(`/verify?proof=${encodeURIComponent(size.proofId)}`);
      }
    }
  });

  it("round-trips versioned JSON payloads across representative sizes", () => {
    for (const size of roundTrip.sizes) {
      const payload = generateVerificationQrJson({
        appUrl: APP_URL,
        proofId: size.proofId,
      });
      expect(JSON.parse(payload)).toEqual({
        v: QR_PAYLOAD_VERSION,
        typ: QR_PAYLOAD_TYPE,
        proof: size.proofId,
      });
      const parsed = parseQrPayload(payload, APP_URL);
      expect(parsed.ok).toBe(true);
      if (parsed.ok) {
        expect(parsed.format).toBe("json");
        expect(parsed.proofId).toBe(size.proofId);
      }
    }
  });

  it("accepts a rotated-but-decoded fixture without using the scanned URL as an href", () => {
    const parsed = parseQrPayload(imageStates.rotated.codes[0], APP_URL);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.proofId).toBe(imageStates.rotated.proofId);
      expect(parsed.verifyPath.startsWith("/verify?proof=")).toBe(true);
      expect(parsed.verifyPath).not.toContain("https://");
    }
  });

  it("treats a blurred/empty decode as unreadable, not as navigation", () => {
    expect(imageStates.blurred.codes).toEqual([]);
    expect(parseQrPayload("", APP_URL)).toEqual({ ok: false, reason: "empty" });
  });

  it("rejects oversized payloads before navigation", () => {
    const oversized = `${imageStates.oversized.rawPrefix}${"A".repeat(QR_MAX_PAYLOAD_BYTES)}`;
    expect(parseQrPayload(oversized, APP_URL)).toEqual({ ok: false, reason: "oversized" });
  });
});

describe("malicious QR fixtures", () => {
  it("rejects javascript/data/file and external URLs without exposing payload content", () => {
    for (const fixture of malicious.cases) {
      const parsed = parseQrPayload(fixture.raw, APP_URL);
      expect(parsed.ok).toBe(false);
      if (!parsed.ok) {
        expect(parsed.reason).toBe(fixture.reason);
        expect(JSON.stringify(parsed)).not.toContain(fixture.raw);
      }
    }
  });
});

describe("scan diagnostics privacy", () => {
  it("never stores scanned credential bodies or full URLs", () => {
    const line = scanDiagnosticToLogLine({
      outcome: "rejected",
      reason: "unsafe-scheme",
      payloadBytes: 32,
    });
    expect(line).not.toContain("javascript:");
    expect(line).not.toContain("http");
    expect(line).not.toContain("ep_");
    expect(JSON.parse(line)).toEqual({
      outcome: "rejected",
      reason: "unsafe-scheme",
      payloadBytes: 32,
    });
  });
});

describe("extractProofId compatibility", () => {
  it("extracts raw proof IDs", () => {
    expect(extractProofId(" ep_7F3A ")).toBe("ep_7F3A");
  });

  it("extracts supported verification links", () => {
    expect(extractProofId("http://localhost:3000/verify?proof=ep_7F3A")).toBe("ep_7F3A");
    expect(extractProofId("https://app.example.com/verify/ep_7F3A")).toBe("ep_7F3A");
  });

  it("rejects unrelated URLs and malformed input", () => {
    expect(extractProofId("https://app.example.com/proofs/ep_7F3A")).toBeNull();
    expect(extractProofId("https://app.example.com/verify?proof=not%20a%20proof")).toBeNull();
    expect(extractProofId("javascript:alert(1)")).toBeNull();
    expect(extractProofId("")).toBeNull();
  });
});
