/**
 * Revision tracking for stale-write conflict detection.
 * 
 * Each entity (Organization, Issuer, TrustedSource, etc.) is tracked with a revision identifier
 * at load time, which is then included in update requests to detect if the server
 * version has changed since the user loaded the form.
 */

import type { Organization, Issuer } from "./generated/v1";

/**
 * Generic type for any entity with revision tracking.
 * Use this as a base for creating revision-tracked types for new entities.
 */
export type WithRevision<T extends object> = T & {
  __revision?: string;
  __loadedAt?: string;
};

/**
 * Wrapper types that extend entities with revision tracking.
 * These track the revision/etag at load time for conflict detection.
 */
export type OrganizationWithRevision = WithRevision<Organization>;

export type IssuerWithRevision = WithRevision<Issuer>;

/**
 * Template for future entities like TrustedSource:
 * 
 * export type TrustedSourceWithRevision = WithRevision<TrustedSource>;
 * 
 * export type UpdateTrustedSourceRequestWithRevision = {
 *   // ... fields specific to TrustedSource updates
 *   __revision?: string;
 * };
 */

/**
 * Update request types that include revision for conflict detection.
 */
export type UpdateOrganizationRequestWithRevision = {
  name?: string;
  website?: string;
  status?: Organization["status"];
  __revision?: string;
};

export type UpdateIssuerRequestWithRevision = {
  name?: string;
  status?: Issuer["status"];
  organizationId?: string;
  __revision?: string;
};

/**
 * Conflict error response from the API (409 Conflict).
 * Contains the current server state so the user can see what changed.
 */
export interface ConflictError extends Error {
  statusCode: 409;
  serverEntity?: Organization | Issuer;
  userSubmittedData?: Record<string, unknown>;
  conflictField?: string;
}

/**
 * Extract and store revision info from an entity at load time.
 * Uses ETag-like behavior: storing the entity itself as the revision key,
 * since ETags are not currently in the API response.
 */
export function captureRevision<T extends object>(entity: T, loadedAt?: Date): T & { __revision?: string; __loadedAt?: string } {
  const withRevision = { ...entity };
  
  // Create a revision hash from the entity (simplified - uses JSON stringification)
  // In production, this would use an actual ETag from response headers
  const revisionHash = createEntityHash(entity);
  
  (withRevision as any).__revision = revisionHash;
  (withRevision as any).__loadedAt = loadedAt?.toISOString() ?? new Date().toISOString();
  
  return withRevision as T & { __revision?: string; __loadedAt?: string };
}

/**
 * Create a stable hash of an entity for revision tracking.
 * This is used as a revision identifier since the API doesn't return ETags yet.
 */
export function createEntityHash(entity: object): string {
  // Create a deterministic hash of core fields
  const str = JSON.stringify(entity);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `${Math.abs(hash)}`;
}

/**
 * Extract revision info for inclusion in an update request.
 * This is sent back to the server to detect conflicts.
 */
export function extractRevision(entity: { __revision?: string; __loadedAt?: string }): {
  revision?: string;
  loadedAt?: string;
} {
  return {
    revision: entity.__revision,
    loadedAt: entity.__loadedAt,
  };
}

/**
 * Check if an error is a 409 Conflict response from the API.
 */
export function isConflictError(error: unknown): error is ConflictError {
  if (error instanceof Error) {
    return (error as any).statusCode === 409;
  }
  return false;
}
