import { apiClient, bearer, retryRead } from "./client";

export type AuditLogEntry = {
  id: string;
  actor: string;
  action: string;
  resource: string;
  occurredAt: string;
  organizationId: string;
  // The hash of this entry chained to the previous entry's hash, so a break
  // anywhere in the chain is detectable without re-verifying every entry
  // from genesis on every page load.
  entryHash: string;
  previousEntryHash: string | null;
};

export type AuditLogFilters = {
  actor?: string;
  action?: string;
  resource?: string;
  /** ISO date (inclusive). */
  dateFrom?: string;
  /** ISO date (inclusive). */
  dateTo?: string;
};

export type AuditLogPage = {
  entries: AuditLogEntry[];
  nextCursor: string | null;
};

export type ChainVerificationStatus = "INTACT" | "BROKEN" | "UNKNOWN";

export type ChainVerificationResult = {
  status: ChainVerificationStatus;
  verifiedThrough: string | null;
  firstBreak: {
    entryId: string;
    sequenceNumber: number;
    detectedAt: string;
  } | null;
};

/**
 * The maximum span a date-range filter may cover. Issue #161 requires large
 * filters stay URL-shareable without embedding sensitive values - bounding
 * the range keeps the resulting query cheap enough to run server-side on
 * every shared link, rather than an open-ended range that a shared URL could
 * turn into an unbounded, sensitive-data-adjacent query.
 */
export const MAX_DATE_RANGE_DAYS = 90;

export function validateDateRange(dateFrom?: string, dateTo?: string): string | null {
  if (!dateFrom || !dateTo) {
    return null;
  }
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  if (isNaN(from.getTime()) || isNaN(to.getTime())) {
    return "Invalid date";
  }
  if (from > to) {
    return "Start date must be before end date";
  }
  const spanDays = (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24);
  if (spanDays > MAX_DATE_RANGE_DAYS) {
    return `Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`;
  }
  return null;
}

function buildQueryString(filters: AuditLogFilters, cursor?: string): string {
  const params = new URLSearchParams();
  if (filters.actor) params.set("actor", filters.actor);
  if (filters.action) params.set("action", filters.action);
  if (filters.resource) params.set("resource", filters.resource);
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  if (cursor) params.set("cursor", cursor);
  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Filters (and the cursor) live entirely in the query string, so a URL to a
 * filtered view is shareable without embedding anything beyond what the
 * viewer already had access to entering the filters themselves - no
 * organization id or other identifier beyond what's already implied by the
 * caller's own auth token.
 */
export async function getAuditLog(
  token: string,
  filters: AuditLogFilters,
  signal: AbortSignal,
  cursor?: string
): Promise<AuditLogPage> {
  return retryRead(async (signal) => {
    return apiClient<AuditLogPage>({
      path: `/audit-log${buildQueryString(filters, cursor)}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export async function verifyAuditChain(token: string, signal: AbortSignal): Promise<ChainVerificationResult> {
  return retryRead(async (signal) => {
    return apiClient<ChainVerificationResult>({
      path: "/audit-log/verify",
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export function formatChainVerificationStatus(status: ChainVerificationStatus): string {
  switch (status) {
    case "INTACT":
      return "Chain intact";
    case "BROKEN":
      return "Chain integrity broken";
    case "UNKNOWN":
      return "Verification unavailable";
  }
}
