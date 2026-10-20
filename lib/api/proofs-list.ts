/**
 * Proofs list API client with cursor-based pagination and filtering support.
 * 
 * The proofs list endpoint supports cursor-based pagination (not offset-based)
 * and optional filtering by status, type, issuer, and date range.
 */

import { apiClient, bearer, retryRead } from "./client";

/**
 * Proof status values that can be filtered on
 */
export type ProofStatus = "PENDING" | "VALID" | "EXPIRED" | "REVOKED";

/**
 * Proof type values that can be filtered on
 */
export type ProofType = "MINIMUM_INCOME" | "PAYMENT_RECEIPT" | "RECURRING_INCOME";

/**
 * A paginated list of proofs returned by the API.
 * Uses cursor-based pagination: pass `pagination.nextCursor` to get the next page.
 */
export type ProofsListResponse = {
  proofs: ProofListItem[];
  pagination: {
    /** Cursor to fetch the next page, or null if at end */
    nextCursor: string | null;
    /** Cursor to fetch the previous page, or null if at start */
    previousCursor: string | null;
    /** Total count of proofs matching the filter (may not include future pages) */
    totalCount?: number;
    /** Whether there are more results after the current page */
    hasMore: boolean;
  };
};

/**
 * Minimal proof info for list display
 */
export type ProofListItem = {
  id: string;
  type: ProofType;
  status: ProofStatus;
  /** Issuer ID that created this proof */
  issuerId: string;
  issuerName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  /** Proof claim summary for display */
  summary: {
    assetCode: string;
    assetIssuer?: string | null;
  };
};

/**
 * Query parameters for listing proofs with optional filters and pagination
 */
export type ListProofsParams = {
  /** Filter by proof status (optional) */
  status?: ProofStatus;
  /** Filter by proof type (optional) */
  type?: ProofType;
  /** Filter by issuer ID (optional) */
  issuerId?: string;
  /** Filter by creation date - start of range (ISO date string, optional) */
  createdFrom?: string;
  /** Filter by creation date - end of range (ISO date string, optional) */
  createdUntil?: string;
  /** Cursor for pagination (optional, omit for first page) */
  cursor?: string;
  /** Page size (default 20, optional) */
  limit?: number;
};

/**
 * Fetch a paginated list of proofs with optional filtering.
 * 
 * @param token Bearer token for authentication
 * @param params Query parameters: filters and pagination cursor
 * @param signal AbortSignal for cancellation
 * @returns ProofsListResponse with proofs array and pagination cursors
 * 
 * @example
 * // First page, no filters
 * const response = await listProofs(token, {}, signal);
 * 
 * // Filter by status and type
 * const validReceipts = await listProofs(token, { 
 *   status: "VALID", 
 *   type: "PAYMENT_RECEIPT" 
 * }, signal);
 * 
 * // Get next page using cursor
 * const nextPage = await listProofs(token, {
 *   cursor: response.pagination.nextCursor,
 *   status: "VALID"
 * }, signal);
 */
export async function listProofs(
  token: string,
  params: ListProofsParams,
  signal: AbortSignal
): Promise<ProofsListResponse> {
  return retryRead(async (signal) => {
    const queryParams = buildQueryParams(params);
    return apiClient<ProofsListResponse>({
      path: `/proofs?${queryParams}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

/**
 * Build a URL query string from list parameters, encoding/filtering for safe API calls
 * @internal
 */
function buildQueryParams(params: ListProofsParams): string {
  const qs = new URLSearchParams();

  if (params.status) {
    qs.append("status", params.status);
  }

  if (params.type) {
    qs.append("type", params.type);
  }

  if (params.issuerId) {
    qs.append("issuerId", params.issuerId);
  }

  if (params.createdFrom) {
    qs.append("createdFrom", params.createdFrom);
  }

  if (params.createdUntil) {
    qs.append("createdUntil", params.createdUntil);
  }

  if (params.cursor) {
    qs.append("cursor", params.cursor);
  }

  if (params.limit) {
    qs.append("limit", String(params.limit));
  }

  return qs.toString();
}

/**
 * Validate that a proof status string is one of the known values
 */
export function isValidProofStatus(value: unknown): value is ProofStatus {
  return typeof value === "string" && ["PENDING", "VALID", "EXPIRED", "REVOKED"].includes(value);
}

/**
 * Validate that a proof type string is one of the known values
 */
export function isValidProofType(value: unknown): value is ProofType {
  return typeof value === "string" && ["MINIMUM_INCOME", "PAYMENT_RECEIPT", "RECURRING_INCOME"].includes(value);
}

/**
 * Validate and sanitize query parameters from URL, returning documented defaults for invalid input
 * 
 * @param params Raw query parameters (possibly from URL)
 * @returns Validated ListProofsParams ready for API call
 * 
 * @remarks
 * Invalid or malformed query parameters degrade to safe defaults:
 * - Unknown status/type/issuer values are dropped (treated as if not specified)
 * - Invalid dates are dropped (treated as if not specified)
 * - Non-positive limits fall back to default (20)
 * - This ensures users never get API errors from stale/bookmarked URLs
 */
export function validateListProofsParams(params: Record<string, unknown>): ListProofsParams {
  const validated: ListProofsParams = {};

  // Validate status
  if (typeof params.status === "string" && isValidProofStatus(params.status)) {
    validated.status = params.status;
  }

  // Validate type
  if (typeof params.type === "string" && isValidProofType(params.type)) {
    validated.type = params.type;
  }

  // Validate issuerId (basic string check, no format validation)
  if (typeof params.issuerId === "string" && params.issuerId.trim()) {
    validated.issuerId = params.issuerId.trim();
  }

  // Validate createdFrom date
  if (typeof params.createdFrom === "string") {
    const dateFrom = validateDateString(params.createdFrom);
    if (dateFrom) {
      validated.createdFrom = dateFrom;
    }
  }

  // Validate createdUntil date
  if (typeof params.createdUntil === "string") {
    const dateUntil = validateDateString(params.createdUntil);
    if (dateUntil) {
      validated.createdUntil = dateUntil;
    }
  }

  // Ensure createdFrom < createdUntil if both present
  if (validated.createdFrom && validated.createdUntil) {
    if (validated.createdFrom >= validated.createdUntil) {
      // Invalid range, drop the later one
      validated.createdUntil = undefined;
    }
  }

  // Validate cursor (opaque string, accept if present)
  if (typeof params.cursor === "string" && params.cursor.trim()) {
    validated.cursor = params.cursor.trim();
  }

  // Validate limit
  if (typeof params.limit === "string" || typeof params.limit === "number") {
    const limitNum = typeof params.limit === "string" ? parseInt(params.limit, 10) : params.limit;
    if (!isNaN(limitNum) && limitNum > 0 && limitNum <= 100) {
      validated.limit = limitNum;
    }
  }

  return validated;
}

/**
 * Validate and normalize an ISO date string.
 * Returns the normalized ISO string on success, or undefined if invalid.
 * @internal
 */
function validateDateString(value: string): string | undefined {
  try {
    const date = new Date(value);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return undefined;
    }
    // Return normalized ISO string (YYYY-MM-DD)
    return date.toISOString().split("T")[0];
  } catch {
    return undefined;
  }
}

/**
 * Helper to format a ProofStatus for display (e.g., "PENDING" -> "Pending")
 */
export function formatProofStatus(status: ProofStatus): string {
  const statusMap: Record<ProofStatus, string> = {
    PENDING: "Pending",
    VALID: "Valid",
    EXPIRED: "Expired",
    REVOKED: "Revoked",
  };
  return statusMap[status] || status;
}

/**
 * Helper to format a ProofType for display (e.g., "MINIMUM_INCOME" -> "Minimum Income")
 */
export function formatProofType(type: ProofType): string {
  const typeMap: Record<ProofType, string> = {
    MINIMUM_INCOME: "Minimum Income",
    PAYMENT_RECEIPT: "Payment Receipt",
    RECURRING_INCOME: "Recurring Income",
  };
  return typeMap[type] || type;
}

/**
 * Get the CSS color class for a proof status (for Tailwind styling)
 */
export function getProofStatusColor(status: ProofStatus): string {
  switch (status) {
    case "VALID":
      return "text-emerald-300 bg-emerald-400/10";
    case "PENDING":
      return "text-amber-300 bg-amber-400/10";
    case "EXPIRED":
      return "text-slate-300 bg-slate-400/10";
    case "REVOKED":
      return "text-rose-300 bg-rose-400/10";
    default:
      return "text-slate-300 bg-slate-400/10";
  }
}
