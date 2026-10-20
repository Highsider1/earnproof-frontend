import { readStoredOrganizationId, storeOrganizationId, clearStoredOrganizationId } from "../store";

describe("organization-context store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("returns null when nothing is stored", () => {
    expect(readStoredOrganizationId()).toBeNull();
  });

  it("stores and reads back an organization id", () => {
    storeOrganizationId("org-1");
    expect(readStoredOrganizationId()).toBe("org-1");
  });

  it("overwrites a previously stored id", () => {
    storeOrganizationId("org-1");
    storeOrganizationId("org-2");
    expect(readStoredOrganizationId()).toBe("org-2");
  });

  it("clears the stored id", () => {
    storeOrganizationId("org-1");
    clearStoredOrganizationId();
    expect(readStoredOrganizationId()).toBeNull();
  });
});
