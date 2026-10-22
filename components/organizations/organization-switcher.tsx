"use client";

import { useState } from "react";
import { useOrganizationContext } from "@/lib/organization-context/context";
import { isOrganizationSelectable } from "@/lib/validation/organization-context";
import type { Organization } from "@/lib/api/generated/v1";

/**
 * Authenticated-navigation organization switcher (#179). Reset of
 * organization-scoped state on switch happens inside
 * OrganizationContextProvider (a fresh `generation`), not here - this
 * component's only job is presenting the list and calling
 * switchOrganization, which already blocks unauthorized/archived
 * selections and waits out in-flight mutations before committing.
 */
export function OrganizationSwitcher({ organizations }: { organizations: Organization[] }) {
  const { organizationId, switchOrganization } = useOrganizationContext();
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSelect(organization: Organization) {
    if (organization.id === organizationId) {
      return;
    }

    setError(null);
    setSwitching(organization.id);
    try {
      await switchOrganization(organization);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch organizations.");
    } finally {
      setSwitching(null);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="text-xs font-semibold text-slate-300" htmlFor="organization-switcher">
        Organization
      </label>
      <select
        id="organization-switcher"
        value={organizationId ?? ""}
        disabled={switching !== null}
        onChange={(event) => {
          const next = organizations.find((organization) => organization.id === event.target.value);
          if (next) {
            void handleSelect(next);
          }
        }}
        className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white disabled:opacity-50"
      >
        <option value="" disabled>
          Select an organization
        </option>
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id} disabled={!isOrganizationSelectable(organization)}>
            {organization.name}
            {!isOrganizationSelectable(organization) ? " (unavailable)" : ""}
          </option>
        ))}
      </select>

      {error && (
        <p className="text-xs text-rose-200" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
