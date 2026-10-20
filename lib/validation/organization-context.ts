import type { Organization } from "@/lib/api/generated/v1";

/**
 * There is no per-user organization-membership field anywhere in the API
 * (AuthUser has a single global role, not a list of organizations the
 * user belongs to - see lib/session.ts and lib/api/generated/v1.ts). The
 * only real signal available is an organization's own status, so
 * "unauthorized or archived" is approximated here as "not selectable
 * unless ACTIVE or PENDING" - an org that's SUSPENDED, REVOKED (the
 * archive lifecycle action's target status), or DELETED can never be
 * switched into. This is disclosed as an approximation: a real
 * implementation would check the caller's actual membership list, which
 * this API does not expose.
 */
const SELECTABLE_STATUSES: ReadonlyArray<Organization["status"]> = ["ACTIVE", "PENDING"];

export function isOrganizationSelectable(organization: Organization): boolean {
  return SELECTABLE_STATUSES.includes(organization.status);
}

export function findSelectedOrganization(
  organizations: Organization[],
  organizationId: string | null,
): Organization | null {
  if (!organizationId) {
    return null;
  }

  const match = organizations.find((organization) => organization.id === organizationId);
  if (!match || !isOrganizationSelectable(match)) {
    return null;
  }

  return match;
}
