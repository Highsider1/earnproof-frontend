import { z } from "zod";

/**
 * A reauth is considered "recent" for this long. There is no server-side
 * reauth/step-up endpoint (see lib/organization-archival/store.ts); this
 * models the client-side recency window a real one would enforce.
 */
export const RECENT_AUTH_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

export function isAuthRecent(verifiedAt: string | null, now: number = Date.now()): boolean {
  if (!verifiedAt) {
    return false;
  }
  return now - new Date(verifiedAt).getTime() <= RECENT_AUTH_WINDOW_MS;
}

/**
 * Typed confirmation requires an exact, case-sensitive match to the
 * organization's current name, mirroring how most "type the resource name
 * to confirm" flows work elsewhere (e.g. GitHub repo deletion).
 */
export function isTypedConfirmationValid(typedValue: string, organizationName: string): boolean {
  return typedValue === organizationName;
}

export const EXPORT_RETENTION_DAYS = 30;

export type ExportStatus = "REQUESTED" | "READY" | "FAILED" | "EXPIRED";

export const organizationExportRequestSchema = z.object({
  organizationId: z.string().min(1, "An organization is required"),
});

export type OrganizationExportRequest = z.infer<typeof organizationExportRequestSchema>;

/**
 * A resource that must be resolved (removed, transferred, or otherwise
 * cleared) before archival can proceed, per "show blocking active
 * resources before archival".
 */
export type ArchivalBlocker = {
  kind: "ACTIVE_ISSUER";
  id: string;
  label: string;
};
