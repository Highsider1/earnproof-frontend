/**
 * Persists only a validated organization id for the next session, per
 * #179's "preserve only a validated organization identifier for the next
 * session" - never the full Organization object (which could go stale),
 * and validity is re-checked against a live GET /organizations response
 * on every read via lib/validation/organization-context.ts's
 * findSelectedOrganization, not trusted from storage alone.
 */
const CURRENT_ORGANIZATION_KEY = "earnproof.current-organization-id";

export function readStoredOrganizationId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(CURRENT_ORGANIZATION_KEY);
}

export function storeOrganizationId(organizationId: string): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(CURRENT_ORGANIZATION_KEY, organizationId);
}

export function clearStoredOrganizationId(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CURRENT_ORGANIZATION_KEY);
}
