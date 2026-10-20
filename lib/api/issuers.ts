import { apiClient, bearer, retryRead, retryMutation } from "./client";
import type { AuthUser, Issuer } from "./generated/v1";
import { captureRevision } from "./revision-tracking";
import type { IssuerWithRevision, UpdateIssuerRequestWithRevision } from "./revision-tracking";

export type CreateIssuerRequest = {
  name: string;
  organizationId?: string;
};

export type UpdateIssuerRequest = {
  name?: string;
  status?: Issuer["status"];
  organizationId?: string;
};

export type PaginatedIssuersResponse = {
  items: Issuer[];
  nextCursor: string | null;
  previousCursor: string | null;
};

// Re-export revision-aware types for use in forms
export type { IssuerWithRevision, UpdateIssuerRequestWithRevision };
export async function getIssuers(token: string, signal: AbortSignal): Promise<IssuerWithRevision[]> {
  return retryRead(async (signal) => {
    const issuers = await apiClient<Issuer[]>({
      path: "/issuers",
      method: "GET",
      headers: bearer(token),
      signal,
    });
    // Capture revision for each issuer at load time
    return issuers.map(issuer => captureRevision(issuer));
  }, signal);
}

export async function getIssuersPaginated(
  token: string,
  pageSize: number = 10,
  nextCursor?: string,
  previousCursor?: string,
  signal?: AbortSignal
): Promise<PaginatedIssuersResponse> {
  return retryRead(async (signal) => {
    const params = new URLSearchParams();
    params.append("limit", String(pageSize));
    if (nextCursor) params.append("next_cursor", nextCursor);
    if (previousCursor) params.append("previous_cursor", previousCursor);

    return apiClient<PaginatedIssuersResponse>({
      path: `/issuers?${params.toString()}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal!);
}

export async function getIssuer(
  token: string,
  issuerId: string,
  signal: AbortSignal
): Promise<IssuerWithRevision> {
  return retryRead(async (signal) => {
    const issuer = await apiClient<Issuer>({
      path: `/issuers/${issuerId}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
    // Capture revision at load time
    return captureRevision(issuer);
  }, signal);
}

export async function createIssuer(
  token: string,
  request: CreateIssuerRequest,
  signal: AbortSignal
): Promise<Issuer> {
  return retryMutation(async (signal) => {
    return apiClient<Issuer>({
      path: "/issuers",
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

export async function updateIssuer(
  token: string,
  issuerId: string,
  request: UpdateIssuerRequest | UpdateIssuerRequestWithRevision,
  signal: AbortSignal
): Promise<IssuerWithRevision> {
  return retryMutation(async (signal) => {
    const issuer = await apiClient<Issuer>({
      path: `/issuers/${issuerId}`,
      method: "PATCH",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
    // Capture new revision after successful update
    return captureRevision(issuer);
  }, signal);
}

export function validateIssuerName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Issuer name is required";
  }
  if (trimmed.length < 2) {
    return "Issuer name must be at least 2 characters";
  }
  if (trimmed.length > 100) {
    return "Issuer name must be less than 100 characters";
  }
  return null;
}

export function formatIssuerStatus(status: Issuer["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PENDING":
      return "Pending";
    case "SUSPENDED":
      return "Suspended";
    case "REVOKED":
      return "Revoked";
    default:
      return status;
  }
}

export function getIssuerStatusTone(status: Issuer["status"]): "success" | "warning" | "accent" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PENDING":
      return "warning";
    case "SUSPENDED":
    case "REVOKED":
      return "warning";
    default:
      return "accent";
  }
}

export type IssuerStatusTransition = "activate" | "suspend" | "revoke";

/**
 * Which status transitions a role may perform (#141: "Only valid status
 * transitions are offered to the current role"). ADMIN can perform every
 * transition. ISSUER is a self-service role limited to activate/suspend —
 * REVOKE is permanent and punitive, and is ADMIN-only. Every other role
 * (WORKER, DEVELOPER, or an unrecognized value) gets none; this function
 * is the single source of truth both the list UI and any future issuer
 * admin surface should consult, rather than duplicating this policy.
 */
const ROLE_TRANSITIONS: Partial<Record<AuthUser["role"], readonly IssuerStatusTransition[]>> = {
  ADMIN: ["activate", "suspend", "revoke"],
  ISSUER: ["activate", "suspend"],
};

/**
 * Takes an arbitrary string, not just `AuthUser["role"]`: the caller's
 * role usually comes from a locally-stored session object (untrusted,
 * `JSON.parse`'d input), so an unrecognized value must degrade to "no
 * transitions allowed" rather than being a type error at the call site.
 */
export function allowedIssuerTransitions(
  role: string | undefined,
): readonly IssuerStatusTransition[] {
  if (!role) return [];
  return ROLE_TRANSITIONS[role as AuthUser["role"]] ?? [];
}

export function canPerformIssuerTransition(
  role: string | undefined,
  transition: IssuerStatusTransition,
): boolean {
  return allowedIssuerTransitions(role).includes(transition);
}