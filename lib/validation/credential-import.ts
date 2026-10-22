/**
 * Shared validation for credential file import (drag-and-drop and file
 * picker) and the existing paste-JSON path in VerifyCredentialForm. Kept
 * dependency-free from the DOM File API's async read so it can be unit
 * tested without jsdom's FileReader quirks (see credential-import.test.ts).
 */

export const MAX_CREDENTIAL_FILE_BYTES = 32 * 1024; // 32 KB, matches the paste path's limit

/** Extensions and MIME types accepted for credential import. Anything else
 * is rejected before its contents are ever read, so an executable or
 * ambiguous file never reaches FileReader/JSON.parse. */
export const ALLOWED_CREDENTIAL_EXTENSIONS = [".json"] as const;
export const ALLOWED_CREDENTIAL_MIME_TYPES = [
  "application/json",
  "text/json",
  "", // some OSes/browsers omit the MIME type for .json; extension still gates it
] as const;

export type CredentialFileRejectReason =
  | "oversized"
  | "unsupported-type"
  | "empty";

export type CredentialFileCheck =
  | { ok: true }
  | { ok: false; reason: CredentialFileRejectReason };

function hasAllowedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return ALLOWED_CREDENTIAL_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * Gate applied before a selected/dropped file is ever read. Both the
 * extension and the browser-reported MIME type must be on the allowlist
 * (when a MIME type is reported at all), and the file must be within the
 * byte limit and non-empty.
 */
export function checkCredentialFile(file: { name: string; size: number; type: string }): CredentialFileCheck {
  if (file.size <= 0) {
    return { ok: false, reason: "empty" };
  }
  if (file.size > MAX_CREDENTIAL_FILE_BYTES) {
    return { ok: false, reason: "oversized" };
  }
  if (!hasAllowedExtension(file.name)) {
    return { ok: false, reason: "unsupported-type" };
  }
  if (!(ALLOWED_CREDENTIAL_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, reason: "unsupported-type" };
  }
  return { ok: true };
}

export type ParsedCredentialId =
  | { ok: true; id: string }
  | { ok: false; reason: "malformed" | "missing-id" };

/**
 * Defensively parse credential JSON text and extract only the `id` field,
 * discarding every other claim field. Shared by both the paste-JSON
 * textbox and the file-import path so the two can never drift.
 */
export function parseCredentialJson(raw: string): ParsedCredentialId {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "malformed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "malformed" };
  }

  const id = (parsed as Record<string, unknown>).id;
  if (typeof id !== "string" || !id.trim()) {
    return { ok: false, reason: "missing-id" };
  }

  return { ok: true, id };
}
