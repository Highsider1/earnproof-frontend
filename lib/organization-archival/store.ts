import { EXPORT_RETENTION_DAYS, type ExportStatus } from "@/lib/validation/organization-archival";

/**
 * No organization data-export endpoint or reauth/step-up endpoint exists in
 * the OpenAPI spec (#172 has no backend support for either). This store
 * tracks export requests and the most recent successful reauth
 * client-side (localStorage, scoped per user), clearly disclosed as a
 * stand-in: a real implementation would have the server generate and host
 * the export file, and would track reauth server-side against the
 * session, not the browser.
 */
export type OrganizationExportRecord = {
  id: string;
  organizationId: string;
  status: ExportStatus;
  requestedAt: string;
  readyAt: string | null;
  expiresAt: string | null;
};

function exportsKey(userId: string): string {
  return `earnproof.organization-exports.${userId}`;
}

function reauthKey(userId: string): string {
  return `earnproof.organization-archival-reauth.${userId}`;
}

function readExports(userId: string): OrganizationExportRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(exportsKey(userId));
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as OrganizationExportRecord[];
  } catch {
    window.localStorage.removeItem(exportsKey(userId));
    return [];
  }
}

function writeExports(userId: string, records: OrganizationExportRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(exportsKey(userId), JSON.stringify(records));
}

export function listOrganizationExports(userId: string, organizationId: string): OrganizationExportRecord[] {
  return readExports(userId).filter((record) => record.organizationId === organizationId);
}

/**
 * Requests an export and immediately marks it READY: there is no real
 * async export pipeline to simulate a delay for, so this models the
 * synchronous best case rather than fabricating a fake processing wait.
 * A FAILED export can still be requested by the caller catching and
 * writing a FAILED record instead (see requestOrganizationExportFailure).
 */
export function requestOrganizationExport(userId: string, organizationId: string): OrganizationExportRecord {
  const now = new Date();
  const record: OrganizationExportRecord = {
    id: `org-export-${crypto.randomUUID()}`,
    organizationId,
    status: "READY",
    requestedAt: now.toISOString(),
    readyAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString(),
  };

  const records = readExports(userId);
  records.push(record);
  writeExports(userId, records);

  return record;
}

export function requestOrganizationExportFailure(userId: string, organizationId: string): OrganizationExportRecord {
  const now = new Date();
  const record: OrganizationExportRecord = {
    id: `org-export-${crypto.randomUUID()}`,
    organizationId,
    status: "FAILED",
    requestedAt: now.toISOString(),
    readyAt: null,
    expiresAt: null,
  };

  const records = readExports(userId);
  records.push(record);
  writeExports(userId, records);

  return record;
}

export function readLastReauthAt(userId: string): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(reauthKey(userId));
}

export function recordReauth(userId: string): string {
  const now = new Date().toISOString();
  if (typeof window !== "undefined") {
    window.localStorage.setItem(reauthKey(userId), now);
  }
  return now;
}
