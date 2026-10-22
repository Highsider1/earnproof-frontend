export const QR_PAYLOAD_VERSION = 1 as const;
export const QR_PAYLOAD_TYPE = "earnproof.verify" as const;
export const QR_MAX_PAYLOAD_BYTES = 512;
export const QR_MAX_PROOF_ID_LENGTH = 64;
export const QR_APPROVED_ROUTES = ["/verify", "/verify/scan"] as const;

const RAW_PROOF_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const UNSAFE_SCHEMES = ["javascript:", "data:", "file:", "blob:", "vbscript:", "about:"];

export type QrPayloadFormat = "url" | "json" | "raw-id";

export type QrRejectReason =
  | "empty"
  | "oversized"
  | "malformed"
  | "unsafe-scheme"
  | "origin-mismatch"
  | "route-mismatch"
  | "invalid-proof-id"
  | "unsupported-version"
  | "multiple-codes";

export type ParsedQrPayload =
  | {
      ok: true;
      format: QrPayloadFormat;
      version: typeof QR_PAYLOAD_VERSION;
      proofId: string;
      verifyPath: string;
    }
  | {
      ok: false;
      reason: QrRejectReason;
    };

export type GenerateQrPayloadInput = {
  appUrl: string;
  proofId: string;
};

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export function isApprovedProofId(value: string): boolean {
  return (
    RAW_PROOF_ID_PATTERN.test(value) &&
    value.length <= QR_MAX_PROOF_ID_LENGTH
  );
}

function appOrigin(appUrl: string): string {
  return new URL(appUrl).origin;
}

function normalizePathname(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname || "/";
}

/**
 * Generate a version-1 QR payload. Only the approved verification URL
 * format is emitted: `{appOrigin}/verify?proof={id}`.
 */
export function generateVerificationQrPayload(input: GenerateQrPayloadInput): string {
  const proofId = input.proofId.trim();
  if (!isApprovedProofId(proofId)) {
    throw new Error("Proof ID is not a valid EarnProof identifier.");
  }
  const origin = appOrigin(input.appUrl);
  return `${origin}/verify?proof=${encodeURIComponent(proofId)}`;
}

export function generateVerificationQrJson(input: GenerateQrPayloadInput): string {
  const proofId = input.proofId.trim();
  if (!isApprovedProofId(proofId)) {
    throw new Error("Proof ID is not a valid EarnProof identifier.");
  }
  return JSON.stringify({
    v: QR_PAYLOAD_VERSION,
    typ: QR_PAYLOAD_TYPE,
    proof: proofId,
  });
}

function looksUnsafeScheme(raw: string): boolean {
  const lower = raw.trim().toLowerCase();
  return UNSAFE_SCHEMES.some((scheme) => lower.startsWith(scheme));
}

function parseJsonPayload(raw: string): ParsedQrPayload {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof parsed !== "object" || parsed === null) {
    return { ok: false, reason: "malformed" };
  }
  const record = parsed as Record<string, unknown>;
  if (record.v !== QR_PAYLOAD_VERSION) {
    return { ok: false, reason: "unsupported-version" };
  }
  if (record.typ !== QR_PAYLOAD_TYPE) {
    return { ok: false, reason: "malformed" };
  }
  if (typeof record.proof !== "string" || !isApprovedProofId(record.proof)) {
    return { ok: false, reason: "invalid-proof-id" };
  }
  return {
    ok: true,
    format: "json",
    version: QR_PAYLOAD_VERSION,
    proofId: record.proof,
    verifyPath: `/verify?proof=${encodeURIComponent(record.proof)}`,
  };
}

function parseUrlPayload(raw: string, appUrl: string): ParsedQrPayload {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "unsafe-scheme" };
  }

  if (url.origin !== appOrigin(appUrl)) {
    return { ok: false, reason: "origin-mismatch" };
  }

  const pathname = normalizePathname(url.pathname);
  if (pathname === "/verify") {
    const proof = url.searchParams.get("proof")?.trim() ?? "";
    if (!isApprovedProofId(proof)) {
      return { ok: false, reason: "invalid-proof-id" };
    }
    return {
      ok: true,
      format: "url",
      version: QR_PAYLOAD_VERSION,
      proofId: proof,
      verifyPath: `/verify?proof=${encodeURIComponent(proof)}`,
    };
  }

  const match = pathname.match(/^\/verify\/([^/]+)$/);
  if (!match) {
    return { ok: false, reason: "route-mismatch" };
  }

  let proof: string;
  try {
    proof = decodeURIComponent(match[1]).trim();
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!isApprovedProofId(proof)) {
    return { ok: false, reason: "invalid-proof-id" };
  }
  return {
    ok: true,
    format: "url",
    version: QR_PAYLOAD_VERSION,
    proofId: proof,
    verifyPath: `/verify?proof=${encodeURIComponent(proof)}`,
  };
}

/**
 * Validate a scanned QR payload before any navigation or credential submit.
 * Navigation targets are always a same-origin `/verify?proof=` path — the
 * scanned string is never used as an href.
 */
export function parseQrPayload(raw: string, appUrl: string): ParsedQrPayload {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty" };
  }
  if (byteLength(trimmed) > QR_MAX_PAYLOAD_BYTES) {
    return { ok: false, reason: "oversized" };
  }
  if (looksUnsafeScheme(trimmed)) {
    return { ok: false, reason: "unsafe-scheme" };
  }
  if (trimmed.startsWith("{")) {
    return parseJsonPayload(trimmed);
  }
  if (isApprovedProofId(trimmed)) {
    return {
      ok: true,
      format: "raw-id",
      version: QR_PAYLOAD_VERSION,
      proofId: trimmed,
      verifyPath: `/verify?proof=${encodeURIComponent(trimmed)}`,
    };
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.includes("://") || trimmed.startsWith("//")) {
    return parseUrlPayload(trimmed, appUrl);
  }
  return { ok: false, reason: "malformed" };
}

export function extractProofId(value: string, appUrl?: string): string | null {
  if (appUrl) {
    const parsed = parseQrPayload(value, appUrl);
    return parsed.ok ? parsed.proofId : null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (byteLength(trimmed) > QR_MAX_PAYLOAD_BYTES || looksUnsafeScheme(trimmed)) {
    return null;
  }
  if (isApprovedProofId(trimmed)) {
    return trimmed;
  }
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    const pathname = normalizePathname(url.pathname);
    if (pathname === "/verify") {
      const proof = url.searchParams.get("proof")?.trim() ?? "";
      return isApprovedProofId(proof) ? proof : null;
    }
    const match = pathname.match(/^\/verify\/([^/]+)$/);
    if (!match) {
      return null;
    }
    const proof = decodeURIComponent(match[1]).trim();
    return isApprovedProofId(proof) ? proof : null;
  } catch {
    return null;
  }
}

export type ScanDiagnostic = {
  outcome:
    | "accepted"
    | "rejected"
    | "camera-unavailable"
    | "camera-denied"
    | "multiple-codes"
    | "unreadable";
  reason?: QrRejectReason | "detector-missing" | "image-unreadable";
  format?: QrPayloadFormat;
  payloadBytes?: number;
};

/**
 * Privacy-safe scan log record. Never include the scanned body, proof ID,
 * or full URL.
 */
export function toScanDiagnostic(
  event: ScanDiagnostic,
): ScanDiagnostic {
  return {
    outcome: event.outcome,
    reason: event.reason,
    format: event.format,
    payloadBytes: event.payloadBytes,
  };
}

export function scanDiagnosticToLogLine(event: ScanDiagnostic): string {
  return JSON.stringify(toScanDiagnostic(event));
}
