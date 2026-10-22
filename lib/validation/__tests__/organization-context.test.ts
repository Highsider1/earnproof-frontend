import { isOrganizationSelectable, findSelectedOrganization } from "../organization-context";
import type { Organization } from "@/lib/api/generated/v1";

function org(status: Organization["status"], id = "org-1"): Organization {
  return { id, name: "Acme", slug: "acme", status };
}

describe("isOrganizationSelectable", () => {
  it("is selectable when ACTIVE", () => {
    expect(isOrganizationSelectable(org("ACTIVE"))).toBe(true);
  });

  it("is selectable when PENDING", () => {
    expect(isOrganizationSelectable(org("PENDING"))).toBe(true);
  });

  it("is not selectable when SUSPENDED", () => {
    expect(isOrganizationSelectable(org("SUSPENDED"))).toBe(false);
  });

  it("is not selectable when REVOKED (archived)", () => {
    expect(isOrganizationSelectable(org("REVOKED"))).toBe(false);
  });

  it("is not selectable when DELETED", () => {
    expect(isOrganizationSelectable(org("DELETED"))).toBe(false);
  });
});

describe("findSelectedOrganization", () => {
  const organizations = [org("ACTIVE", "org-1"), org("REVOKED", "org-2")];

  it("returns null when organizationId is null", () => {
    expect(findSelectedOrganization(organizations, null)).toBeNull();
  });

  it("returns the matching organization when selectable", () => {
    expect(findSelectedOrganization(organizations, "org-1")).toEqual(org("ACTIVE", "org-1"));
  });

  it("returns null for an archived organization even if the id matches", () => {
    expect(findSelectedOrganization(organizations, "org-2")).toBeNull();
  });

  it("returns null for an id not in the list", () => {
    expect(findSelectedOrganization(organizations, "org-999")).toBeNull();
  });
});
