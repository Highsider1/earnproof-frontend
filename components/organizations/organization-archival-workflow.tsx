"use client";

import { useState } from "react";
import { formatDate } from "@/lib/i18n";
import { performLifecycleAction, type ApiResult } from "@/lib/api/organizations";
import type { Organization, Issuer } from "@/lib/api/generated/v1";
import {
  isAuthRecent,
  isTypedConfirmationValid,
  type ArchivalBlocker,
} from "@/lib/validation/organization-archival";
import {
  requestOrganizationExport,
  requestOrganizationExportFailure,
  listOrganizationExports,
  readLastReauthAt,
  recordReauth,
  type OrganizationExportRecord,
} from "@/lib/organization-archival/store";

/**
 * Organization archival and data export workflow (#172). Archival is
 * always framed as a distinct, reversible-adjacent step from the
 * irreversible-deletion-eligible state it produces: this component never
 * calls a delete endpoint, only the existing archive lifecycle action
 * (which the API maps to REVOKED, per lib/api/organizations.ts), and
 * "Archive Organization" is never labeled or described as deletion.
 */
export function OrganizationArchivalWorkflow({
  organization,
  issuers,
  token,
  userId,
  onArchived,
}: {
  organization: Organization;
  issuers: Issuer[];
  token: string;
  userId: string;
  onArchived: (result: Organization) => void;
}) {
  const blockers: ArchivalBlocker[] = issuers
    .filter((issuer) => issuer.organizationId === organization.id && issuer.status === "ACTIVE")
    .map((issuer) => ({ kind: "ACTIVE_ISSUER" as const, id: issuer.id, label: issuer.name }));

  const [exportRecord, setExportRecord] = useState<OrganizationExportRecord | null>(
    () => listOrganizationExports(userId, organization.id).at(-1) ?? null,
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [lastReauthAt, setLastReauthAt] = useState<string | null>(() => readLastReauthAt(userId));
  const [reauthing, setReauthing] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

  function requestExport() {
    setExportError(null);
    try {
      const record = requestOrganizationExport(userId, organization.id);
      setExportRecord(record);
    } catch {
      const record = requestOrganizationExportFailure(userId, organization.id);
      setExportRecord(record);
      setExportError("Export request failed. Try again.");
    }
  }

  async function reauth() {
    setReauthing(true);
    setArchiveError(null);
    try {
      const freighter = await import("@stellar/freighter-api");
      const access = await freighter.requestAccess().catch(() => null);
      const walletAddress = access?.address ?? (await freighter.getAddress().catch(() => null))?.address ?? null;

      if (!walletAddress) {
        setArchiveError("Freighter was not found or did not return a Stellar address.");
        return;
      }

      const timestamp = recordReauth(userId);
      setLastReauthAt(timestamp);
    } catch {
      setArchiveError("Re-authentication failed. Try again.");
    } finally {
      setReauthing(false);
    }
  }

  const hasBlockers = blockers.length > 0;
  const hasReadyExport = exportRecord?.status === "READY";
  const authRecent = isAuthRecent(lastReauthAt);
  const confirmationValid = isTypedConfirmationValid(typedName, organization.name);
  const canArchive = !hasBlockers && hasReadyExport && authRecent && confirmationValid && !archiving;

  async function archive() {
    if (!canArchive) {
      return;
    }

    setArchiving(true);
    setArchiveError(null);

    const controller = new AbortController();
    const result: ApiResult<Organization> = await performLifecycleAction(
      token,
      organization.id,
      "archive",
      controller.signal,
    );

    setArchiving(false);

    if (!result.success) {
      // Failed transitions leave the organization usable according to its
      // prior state: performLifecycleAction never mutated local state, so
      // there is nothing to roll back here, only an error to surface.
      setArchiveError(result.error.message);
      return;
    }

    onArchived(result.data);
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Archival readiness</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Archiving restricts access and stops billing, but is not deletion. Data is retained.
            Archival becomes eligible for a future, separately-confirmed deletion only once
            retention requirements have been met.
          </p>
        </div>

        {hasBlockers ? (
          <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
            <p className="text-sm font-semibold text-amber-200">Active resources must be resolved first</p>
            <ul className="mt-2 grid gap-1 text-xs text-amber-200/80">
              {blockers.map((blocker) => (
                <li key={blocker.id}>Active issuer: {blocker.label}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="rounded-md border border-emerald-300/30 bg-emerald-300/10 p-3">
            <p className="text-sm text-emerald-200">No active resources are blocking archival.</p>
          </div>
        )}
      </section>

      <section className="grid gap-3 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Data export</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Request a privacy-safe export before archiving. Exports are retained for 30 days.
          </p>
        </div>

        <button
          type="button"
          onClick={requestExport}
          className="h-10 w-fit rounded-md border border-white/15 px-4 text-xs font-semibold text-white"
        >
          Request export
        </button>

        {exportError && (
          <p className="text-sm text-rose-200" role="alert">
            {exportError}
          </p>
        )}

        {exportRecord && (
          <dl className="grid gap-1 text-xs text-slate-300">
            <div className="flex justify-between">
              <dt>Status</dt>
              <dd className="font-semibold">{exportRecord.status}</dd>
            </div>
            {exportRecord.expiresAt && (
              <div className="flex justify-between">
                <dt>Retention deadline</dt>
                <dd>{formatDate(new Date(exportRecord.expiresAt))}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section className="grid gap-3 rounded-lg border border-rose-300/30 bg-rose-300/5 p-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Archive organization</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Requires a ready export, no blocking resources, a recent re-authentication, and typing
            the organization&apos;s name to confirm.
          </p>
        </div>

        {!authRecent && (
          <button
            type="button"
            onClick={() => void reauth()}
            disabled={reauthing}
            className="h-10 w-fit rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
          >
            {reauthing ? "Verifying..." : "Re-authenticate"}
          </button>
        )}

        <label className="grid gap-2 text-sm text-slate-200" htmlFor="archival-confirm-name">
          Type <span className="font-semibold text-white">{organization.name}</span> to confirm
          <input
            id="archival-confirm-name"
            type="text"
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
          />
        </label>

        {archiveError && (
          <p className="text-sm text-rose-200" role="alert">
            {archiveError}
          </p>
        )}

        <button
          type="button"
          onClick={() => void archive()}
          disabled={!canArchive}
          className="h-10 w-fit rounded-md bg-rose-600 px-4 text-xs font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {archiving ? "Archiving..." : "Archive Organization"}
        </button>
      </section>
    </div>
  );
}
