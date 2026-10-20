import { extractProofId, isApprovedProofId } from "./qr-payload";

/**
 * No batch/bulk verify endpoint exists in the OpenAPI spec (#182 has no
 * backend support at all - grepped lib/api/openapi/earnproof-api.v1.json
 * and lib/api/generated/v1.ts for "batch"/"bulk", zero matches). This
 * batch is built as N parallel calls to the existing single
 * GET /proofs/{id}/verify endpoint (used by verify-proof-form.tsx), not a
 * new backend endpoint. The API limit referenced in the issue is
 * approximated as MAX_BATCH_ITEMS below, matching the per-file/per-item
 * caps used for #183's batch credential workspace in this same program.
 */
export const MAX_BATCH_ITEMS = 50;

export type BatchProofRowStatus = "VALID_ID" | "INVALID_ID" | "DUPLICATE";

export type BatchProofRow = {
  raw: string;
  normalizedId: string | null;
  status: BatchProofRowStatus;
};

/**
 * Parses pasted or uploaded text (one identifier or verification URL per
 * line) into preview rows: each row is validated and de-duplicated
 * independently, so one invalid or duplicate row never prevents the rest
 * from being previewed, per "invalid rows do not prevent valid rows from
 * being reviewed".
 */
export function parseBatchProofInput(rawText: string): BatchProofRow[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_BATCH_ITEMS);

  const seen = new Set<string>();
  const rows: BatchProofRow[] = [];

  for (const raw of lines) {
    const normalizedId = extractProofId(raw) ?? (isApprovedProofId(raw) ? raw : null);

    if (!normalizedId) {
      rows.push({ raw, normalizedId: null, status: "INVALID_ID" });
      continue;
    }

    if (seen.has(normalizedId)) {
      rows.push({ raw, normalizedId, status: "DUPLICATE" });
      continue;
    }

    seen.add(normalizedId);
    rows.push({ raw, normalizedId, status: "VALID_ID" });
  }

  return rows;
}
