import { apiClient, bearer, retryRead, retryMutation } from "./client";
import { captureRevision } from "./revision-tracking";
import { normalizeError, type NormalizedError } from "./error-normalization";
import type { Organization } from "./generated/v1";
import type { OrganizationWithRevision, UpdateOrganizationRequestWithRevision } from "./revision-tracking";

export type CreateOrganizationRequest = {
  name: string;
  slug: string;
  website?: string;
};

export type UpdateOrganizationRequest = {
  name?: string;
  website?: string;
  status?: Organization["status"];
};

export type PaginatedOrganizationsResponse = {
  items: Organization[];
  nextCursor: string | null;
  previousCursor: string | null;
};

// Re-export revision-aware types for use in forms
export type { OrganizationWithRevision, UpdateOrganizationRequestWithRevision };

/**
 * Lifecycle status types
 */
export type OrganizationStatus = Organization["status"];

/**
 * Lifecycle action results with error normalization
 */
export type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: NormalizedError };

export async function getOrganizations(token: string, signal: AbortSignal): Promise<OrganizationWithRevision[]> {
  return retryRead(async (signal) => {
    const orgs = await apiClient<Organization[]>({
      path: "/organizations",
      method: "GET",
      headers: bearer(token),
      signal,
    });
    // Capture revision for each organization at load time
    return orgs.map(org => captureRevision(org));
  }, signal);
}

export async function getOrganizationsPaginated(
  token: string,
  pageSize: number = 10,
  nextCursor?: string,
  previousCursor?: string,
  signal?: AbortSignal
): Promise<PaginatedOrganizationsResponse> {
  return retryRead(async (signal) => {
    const params = new URLSearchParams();
    params.append("limit", String(pageSize));
    if (nextCursor) params.append("next_cursor", nextCursor);
    if (previousCursor) params.append("previous_cursor", previousCursor);

    return apiClient<PaginatedOrganizationsResponse>({
      path: `/organizations?${params.toString()}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal!);
}

export async function getOrganization(
  token: string,
  organizationId: string,
  signal: AbortSignal
): Promise<OrganizationWithRevision> {
  return retryRead(async (signal) => {
    const org = await apiClient<Organization>({
      path: `/organizations/${organizationId}`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
    // Capture revision at load time
    return captureRevision(org);
  }, signal);
}

export async function createOrganization(
  token: string,
  request: CreateOrganizationRequest,
  signal: AbortSignal
): Promise<Organization> {
  return retryMutation(async (signal) => {
    return apiClient<Organization>({
      path: "/organizations",
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

export async function updateOrganization(
  token: string,
  organizationId: string,
  request: UpdateOrganizationRequest | UpdateOrganizationRequestWithRevision,
  signal: AbortSignal
): Promise<OrganizationWithRevision> {
  return retryMutation(async (signal) => {
    const org = await apiClient<Organization>({
      path: `/organizations/${organizationId}`,
      method: "PATCH",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
    // Capture new revision after successful update
    return captureRevision(org);
  }, signal);
}

/**
 * Safe wrapper around updateOrganization that returns normalized errors
 */
export async function updateOrganizationSafe(
  token: string,
  organizationId: string,
  request: UpdateOrganizationRequest,
  signal: AbortSignal
): Promise<ApiResult<Organization>> {
  try {
    const data = await updateOrganization(token, organizationId, request, signal);
    return { success: true, data };
  } catch (error) {
    const normalizedError = await normalizeError(error);
    return { success: false, error: normalizedError };
  }
}

/**
 * Lifecycle state transition action
 */
export type LifecycleAction = "activate" | "suspend" | "archive" | "revoke";

/**
 * Map lifecycle action to target status
 */
export function getStatusForLifecycleAction(
  action: LifecycleAction
): Organization["status"] {
  switch (action) {
    case "activate":
      return "ACTIVE";
    case "suspend":
      return "SUSPENDED";
    case "archive":
      // Note: if API doesn't support archive, this could map to REVOKED or a custom state
      return "REVOKED";
    case "revoke":
      return "REVOKED";
  }
}

/**
 * Perform a lifecycle action on an organization (safe version)
 */
export async function performLifecycleAction(
  token: string,
  organizationId: string,
  action: LifecycleAction,
  signal: AbortSignal
): Promise<ApiResult<Organization>> {
  const status = getStatusForLifecycleAction(action);
  return updateOrganizationSafe(token, organizationId, { status }, signal);
}

export function validateOrganizationName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Organization name is required";
  }
  if (trimmed.length < 2) {
    return "Organization name must be at least 2 characters";
  }
  if (trimmed.length > 100) {
    return "Organization name must be less than 100 characters";
  }
  return null;
}

export function validateOrganizationSlug(slug: string): string | null {
  const trimmed = slug.trim();
  if (!trimmed) {
    return "Organization slug is required";
  }
  if (trimmed.length < 3) {
    return "Slug must be at least 3 characters";
  }
  if (trimmed.length > 50) {
    return "Slug must be less than 50 characters";
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    return "Slug can only contain lowercase letters, numbers, and hyphens";
  }
  if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    return "Slug cannot start or end with a hyphen";
  }
  if (trimmed.includes('--')) {
    return "Slug cannot contain consecutive hyphens";
  }
  return null;
}

export function validateWebsiteUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) {
    return null; // Optional field
  }
  
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return "Website URL must use http or https protocol";
    }
    return null;
  } catch {
    return "Please enter a valid website URL";
  }
}

export function formatOrganizationStatus(status: Organization["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "PENDING":
      return "Pending";
    case "SUSPENDED":
      return "Suspended";
    case "REVOKED":
      return "Revoked";
    case "DELETED":
      return "Deleted";
    default:
      return status;
  }
}

export function getStatusTone(status: Organization["status"]): "success" | "warning" | "accent" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "PENDING":
      return "warning";
    case "SUSPENDED":
    case "REVOKED":
    case "DELETED":
      return "warning";
    default:
      return "accent";
  }
}