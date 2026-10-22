"use client";

import { Fragment, useCallback, useState } from "react";
import { updateOrganization, formatOrganizationStatus, getStatusTone, getOrganization, type LifecycleAction } from "@/lib/api/organizations";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { CursorPagination, type PaginationState } from "@/components/common/cursor-pagination";
import { ResultsHeading } from "@/components/common/results-heading";
import { ResolveConflictDialog } from "@/components/forms/resolve-conflict-dialog";
import { StatusBadge } from "@/components/common/production-ui";
import { RecentAuthGate } from "@/components/common/recent-auth-gate";
import { useRecentAuth } from "@/lib/auth/recent-auth";
import { signWithFreighter } from "@/lib/wallet/sign-message";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyState,
  DataTableHead,
  DataTableHeadCell,
  DataTablePagination,
  DataTableRow,
  useDataTableState,
} from "@/components/common/data-table";
import { OrganizationMembers } from "@/components/organizations/organization-members";
import { formatMessage } from "@/lib/i18n";
import { ApiConflictError } from "@/lib/api/client";
import { useConflictResolution } from "@/hooks/use-conflict-resolution";
import type { OrganizationWithRevision } from "@/lib/api/organizations";

const organizationActionLabels: Record<LifecycleAction, string> = {
  suspend: "Suspend",
  activate: "Activate",
  revoke: "Revoke",
  archive: "Archive",
};

export function OrganizationList({
  organizations,
  loading,
  token,
  walletAddress,
  paginationState,
  onPreviousPage,
  onNextPage,
  focusResults,
  onOrganizationUpdated,
}: {
  organizations: OrganizationWithRevision[];
  loading: boolean;
  token: string;
  walletAddress: string;
  paginationState: PaginationState;
  onPreviousPage: () => void;
  onNextPage: () => void;
  focusResults: boolean;
  onOrganizationUpdated: (organization: OrganizationWithRevision) => void;
}) {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedMembersId, setExpandedMembersId] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{
    type: LifecycleAction;
    organizationId: string;
    organizationName: string;
  } | null>(null);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationWithRevision | null>(null);
  const [pendingActionName, setPendingActionName] = useState<{ label: string; organizationName: string } | null>(null);
  const recentAuth = useRecentAuth({
    walletAddress,
    signMessage: (message) => signWithFreighter(message, walletAddress),
  });

  const {
    conflict,
    isRetrying,
    isReloading,
    showConflict,
    handleReload,
    handleRetry,
    handleAbandon,
  } = useConflictResolution({
    onReloadEntity: async () => {
      if (!confirmAction) return;
      try {
        const controller = new AbortController();
        const org = await getOrganization(token, confirmAction.organizationId, controller.signal);
        onOrganizationUpdated(org);
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    },
    onRetrySubmit: async (formState) => {
      if (!confirmAction) return;
      try {
        const statusMap: Record<LifecycleAction, OrganizationWithRevision["status"]> = {
          suspend: "SUSPENDED",
          activate: "ACTIVE",
          revoke: "REVOKED",
          archive: "REVOKED",
        };
        const controller = new AbortController();
        const updated = await updateOrganization(
          token,
          confirmAction.organizationId,
          {
            status: statusMap[confirmAction.type],
            __revision: formState.__revision as string | undefined,
          },
          controller.signal
        );
        onOrganizationUpdated(updated);
      } finally {
        setActionLoading(null);
        setConfirmAction(null);
      }
    },
  });

  const handleStatusUpdate = useCallback(async (
    organizationId: string,
    newStatus: OrganizationWithRevision["status"],
    org: OrganizationWithRevision
  ) => {
    setActionLoading(organizationId);
    setError(null);
    setCurrentOrganization(org);
    
    try {
      const controller = new AbortController();
      const updated = await updateOrganization(
        token,
        organizationId,
        { 
          status: newStatus,
          __revision: org.__revision
        },
        controller.signal
      );
      onOrganizationUpdated(updated);
    } catch (err) {
      if (err instanceof ApiConflictError) {
        // Show conflict dialog with the current organization and intended status change
        const intendedState = { ...org, status: newStatus };
        showConflict(err, intendedState, ["status", "name", "website"]);
      } else {
        setError("Failed to update organization status. Please try again.");
      }
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }, [token, onOrganizationUpdated, showConflict]);

  const announcement = focusResults && organizations.length > 0
    ? formatMessage(
        organizations.length === 1
          ? "Results updated. Showing {count} organization."
          : "Results updated. Showing {count} organizations.",
        { count: organizations.length }
      )
    : undefined;

  const { sortKey, sortDirection, toggleSort, pageItems, page, pageCount, setPage } =
    useDataTableState(organizations, {
      pageSize: 10,
      getSortValue: (org, key) => (key === "name" ? org.name : org.status),
    });

  if (loading && organizations.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading organizations...</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <DataTable caption="Organizations">
          <DataTableHead>
            <DataTableHeadCell
              sortDirection={sortKey === "name" ? sortDirection : undefined}
              onSort={() => toggleSort("name")}
            >
              Organization
            </DataTableHeadCell>
            <DataTableHeadCell
              sortDirection={sortKey === "status" ? sortDirection : undefined}
              onSort={() => toggleSort("status")}
            >
              Status
            </DataTableHeadCell>
            <DataTableHeadCell>Created</DataTableHeadCell>
            <DataTableHeadCell>Actions</DataTableHeadCell>
          </DataTableHead>
          {organizations.length === 0 ? (
            <DataTableEmptyState colSpan={4}>
              No organizations found. Create your first organization above.
            </DataTableEmptyState>
          ) : (
            <DataTableBody>
              {pageItems.map((org) => (
                <Fragment key={org.id}>
                  <OrganizationRow
                    organization={org}
                    isLoading={actionLoading === org.id}
                    isMembersExpanded={expandedMembersId === org.id}
                    onSuspend={() =>
                      setConfirmAction({
                        type: "suspend",
                        organizationId: org.id,
                        organizationName: org.name,
                      })
                    }
                    onActivate={() =>
                      setConfirmAction({
                        type: "activate",
                        organizationId: org.id,
                        organizationName: org.name,
                      })
                    }
                    onRevoke={() =>
                      setConfirmAction({
                        type: "revoke",
                        organizationId: org.id,
                        organizationName: org.name,
                      })
                    }
                    onToggleMembers={() =>
                      setExpandedMembersId((current) => (current === org.id ? null : org.id))
                    }
                  />
                  {expandedMembersId === org.id && (
                    <tr>
                      <td colSpan={4} className="px-4 py-3">
                        <OrganizationMembers
                          organizationId={org.id}
                          organizationName={org.name}
                          token={token}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </DataTableBody>
          )}
        </DataTable>
        <DataTablePagination page={page} pageCount={pageCount} onPageChange={setPage} />
        {/* Results heading with focus management and announcements */}
        <ResultsHeading
          onFocusRequested={focusResults}
          announcement={announcement}
        >
          Organizations
        </ResultsHeading>

        {/* Desktop header */}
        <div className="hidden grid-cols-[2fr_1fr_1fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
          <div>Organization</div>
          <div>Status</div>
          <div>Created</div>
          <div>Actions</div>
        </div>

        {organizations.map((org) => (
          <OrganizationRow
            key={org.id}
            organization={org}
            onEdit={() => onEditOrganization(org.id)}
            onSuspend={() => 
              onLifecycleAction("suspend", org.id, org.name)
            }
            onActivate={() => 
              onLifecycleAction("activate", org.id, org.name)
            }
            onRevoke={() =>
              onLifecycleAction("revoke", org.id, org.name)
            }
          />
        ))}
      </div>

      {/* Pagination controls */}
      <div className="mt-4">
        <CursorPagination
          state={{
            ...paginationState,
            isLoading: loading,
          }}
          onPrevious={onPreviousPage}
          onNext={onNextPage}
          resultCount={organizations.length}
        />
      </div>

      {conflict.isActive && (
        <ResolveConflictDialog
          entityType="Organization"
          entityId={confirmAction?.organizationId ?? ""}
          conflicts={conflict.conflicts}
          localFormState={conflict.localFormState}
          onRetry={handleRetry}
          onReload={handleReload}
          onAbandon={handleAbandon}
          isRetrying={isRetrying || isReloading}
        />
      )}
    </>
  );
}

function OrganizationRow({
  organization,
  isLoading,
  isMembersExpanded,
  onSuspend,
  onActivate,
  onRevoke,
  onToggleMembers,
}: {
  organization: OrganizationWithRevision;
  isLoading: boolean;
  isMembersExpanded: boolean;
  onSuspend: () => void;
  onActivate: () => void;
  onRevoke: () => void;
  onToggleMembers: () => void;
}) {
  const canSuspend = organization.status === "ACTIVE";
  const canActivate = organization.status === "SUSPENDED" || organization.status === "PENDING";
  const canRevoke = organization.status !== "REVOKED" && organization.status !== "DELETED";

  return (
    <DataTableRow>
      <DataTableCell>
        <div className="min-w-0">
          <div className="font-medium text-white">{organization.name}</div>
          <div className="mt-1 font-mono text-xs text-slate-400">
            {organization.slug}
          </div>
          {organization.website && (
            <div className="mt-1 text-xs">
              <a
                href={organization.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-300 hover:text-cyan-200 transition"
              >
                {organization.website}
              </a>
            </div>
          )}
        </div>
      </DataTableCell>

      <DataTableCell>
        <StatusBadge tone={getStatusTone(organization.status)}>
          {formatOrganizationStatus(organization.status)}
        </StatusBadge>
      </DataTableCell>

      <DataTableCell>
        <div className="text-slate-400">
          {/* Using placeholder since creation date is not in API response */}
          Recently
        </div>
      </DataTableCell>

      <DataTableCell>
        <div className="flex flex-wrap gap-2">
          <button
            aria-expanded={isMembersExpanded}
            className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/5 transition"
            onClick={onToggleMembers}
            type="button"
          >
            {isMembersExpanded ? "Hide Members" : "Manage Members"}
          </button>
          {canActivate && (
            <button
              onClick={onActivate}
              disabled={isLoading}
              className="h-8 rounded border border-emerald-300/30 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 disabled:opacity-50 transition"
            >
              {isLoading ? "..." : "Activate"}
            </button>
          )}
          {canSuspend && (
            <button
              onClick={onSuspend}
              disabled={isLoading}
              className="h-8 rounded border border-amber-300/30 px-3 text-xs font-medium text-amber-200 hover:bg-amber-300/10 disabled:opacity-50 transition"
            >
              {isLoading ? "..." : "Suspend"}
            </button>
          )}
          {canRevoke && (
            <button
              onClick={onRevoke}
              disabled={isLoading}
              className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 disabled:opacity-50 transition"
            >
              {isLoading ? "..." : "Revoke"}
            </button>
          )}
        </div>
      </DataTableCell>
    </DataTableRow>
  );
}
