import { checkCredentialFile, parseCredentialJson, MAX_CREDENTIAL_FILE_BYTES } from "./credential-import";

/**
 * A batch is bounded independently of the single-file limit in
 * credential-import.ts: both the number of items and their combined size
 * are capped so a workspace with many files can't be used to stage an
 * unbounded upload (#183's "not uploading unbounded files").
 */
export const MAX_BATCH_ITEMS = 50;
export const MAX_BATCH_TOTAL_BYTES = MAX_CREDENTIAL_FILE_BYTES * 20; // 640 KB combined

export type BatchItemSource = "file" | "manual";

export type BatchItemRejectReason =
  | "oversized"
  | "unsupported-type"
  | "empty"
  | "malformed"
  | "missing-id"
  | "duplicate";

export type BatchAcceptResult =
  | { ok: true; id: string }
  | { ok: false; reason: BatchItemRejectReason };

/**
 * Validates one batch item (already-read file text, or a manually pasted
 * JSON string) independently of every other item in the batch: a malformed
 * item here never prevents the caller from accepting the rest, per #183's
 * "one malformed item does not hide other results".
 */
export function acceptBatchItem(rawJson: string, existingIds: readonly string[]): BatchAcceptResult {
  const parsed = parseCredentialJson(rawJson);
  if (!parsed.ok) {
    return { ok: false, reason: parsed.reason };
  }

  if (existingIds.includes(parsed.id)) {
    return { ok: false, reason: "duplicate" };
  }

  return { ok: true, id: parsed.id };
}

export type BatchFileCheck =
  | { ok: true }
  | { ok: false; reason: "too-many-items" | "batch-too-large" | BatchItemRejectReason };

/**
 * Gate applied to a candidate file before it is read, mirroring
 * checkCredentialFile but also enforcing the batch-level item count and
 * combined-size caps.
 */
export function checkBatchFile(
  file: { name: string; size: number; type: string },
  currentItemCount: number,
  currentTotalBytes: number,
): BatchFileCheck {
  if (currentItemCount >= MAX_BATCH_ITEMS) {
    return { ok: false, reason: "too-many-items" };
  }

  if (currentTotalBytes + file.size > MAX_BATCH_TOTAL_BYTES) {
    return { ok: false, reason: "batch-too-large" };
  }

  const fileCheck = checkCredentialFile(file);
  if (!fileCheck.ok) {
    return fileCheck;
  }

  return { ok: true };
}
