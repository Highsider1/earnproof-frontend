import {
  requestOrganizationExport,
  requestOrganizationExportFailure,
  listOrganizationExports,
  readLastReauthAt,
  recordReauth,
} from "../store";

describe("organization-archival store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("exports", () => {
    it("creates a READY export with an expiry", () => {
      const record = requestOrganizationExport("user-1", "org-1");
      expect(record.status).toBe("READY");
      expect(record.expiresAt).not.toBeNull();
      expect(new Date(record.expiresAt!).getTime()).toBeGreaterThan(new Date(record.requestedAt).getTime());
    });

    it("creates a FAILED export with no expiry", () => {
      const record = requestOrganizationExportFailure("user-1", "org-1");
      expect(record.status).toBe("FAILED");
      expect(record.expiresAt).toBeNull();
      expect(record.readyAt).toBeNull();
    });

    it("lists exports scoped to an organization", () => {
      requestOrganizationExport("user-1", "org-1");
      requestOrganizationExport("user-1", "org-2");

      expect(listOrganizationExports("user-1", "org-1")).toHaveLength(1);
      expect(listOrganizationExports("user-1", "org-2")).toHaveLength(1);
    });

    it("scopes exports per user", () => {
      requestOrganizationExport("user-1", "org-1");
      expect(listOrganizationExports("user-2", "org-1")).toEqual([]);
    });

    it("accumulates multiple export attempts for the same org", () => {
      requestOrganizationExportFailure("user-1", "org-1");
      requestOrganizationExport("user-1", "org-1");

      const exports = listOrganizationExports("user-1", "org-1");
      expect(exports).toHaveLength(2);
      expect(exports.map((record) => record.status)).toEqual(["FAILED", "READY"]);
    });
  });

  describe("reauth tracking", () => {
    it("returns null when no reauth has been recorded", () => {
      expect(readLastReauthAt("user-1")).toBeNull();
    });

    it("records and reads back a reauth timestamp", () => {
      const timestamp = recordReauth("user-1");
      expect(readLastReauthAt("user-1")).toBe(timestamp);
    });

    it("scopes reauth per user", () => {
      recordReauth("user-1");
      expect(readLastReauthAt("user-2")).toBeNull();
    });

    it("overwrites the previous reauth timestamp on a new reauth", () => {
      recordReauth("user-1");
      const second = recordReauth("user-1");
      expect(readLastReauthAt("user-1")).toBe(second);
    });
  });
});
