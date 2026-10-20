import {
  SCOPE_CATALOG,
  scopeCatalogByCategory,
  scopeCatalogEntry,
  isKnownScope,
  hasBroadScope,
  incompatibleScopePairs,
} from "./scope-catalog";
import { AVAILABLE_SCOPES } from "@/lib/api/keys";

describe("SCOPE_CATALOG", () => {
  it("has exactly one entry per AVAILABLE_SCOPES entry", () => {
    expect(SCOPE_CATALOG.map((entry) => entry.scope).sort()).toEqual(
      [...AVAILABLE_SCOPES].sort(),
    );
  });
});

describe("scopeCatalogByCategory", () => {
  it("groups all known scopes into non-empty categories", () => {
    const groups = scopeCatalogByCategory();
    const scopesInGroups = groups.flatMap((g) => g.scopes.map((s) => s.scope));

    expect(scopesInGroups.sort()).toEqual([...AVAILABLE_SCOPES].sort());
    for (const group of groups) {
      expect(group.scopes.length).toBeGreaterThan(0);
    }
  });
});

describe("scopeCatalogEntry / isKnownScope", () => {
  it("resolves a known scope", () => {
    expect(scopeCatalogEntry("proofs:read")?.scope).toBe("proofs:read");
    expect(isKnownScope("proofs:read")).toBe(true);
  });

  it("fails closed for an unknown scope: returns null, not a generic entry", () => {
    expect(scopeCatalogEntry("proofs:delete-everything")).toBeNull();
    expect(isKnownScope("proofs:delete-everything")).toBe(false);
  });

  it("fails closed for an empty string", () => {
    expect(scopeCatalogEntry("")).toBeNull();
  });
});

describe("hasBroadScope", () => {
  it("is false for an empty scope set", () => {
    expect(hasBroadScope([])).toBe(false);
  });

  it("is false for a minimal, read-only scope set", () => {
    expect(hasBroadScope(["verification:read", "proofs:read"])).toBe(false);
  });

  it("is true when a broad scope (webhooks:manage) is present", () => {
    expect(hasBroadScope(["webhooks:manage"])).toBe(true);
  });

  it("is true for a broad scope mixed into an otherwise narrow set", () => {
    expect(hasBroadScope(["verification:read", "webhooks:manage"])).toBe(true);
  });

  it("ignores unknown scopes rather than crashing on them", () => {
    expect(hasBroadScope(["not-a-real-scope"])).toBe(false);
  });
});

describe("incompatibleScopePairs", () => {
  it("reports no conflicts for the current scope set (none are documented as conflicting)", () => {
    expect(incompatibleScopePairs([...AVAILABLE_SCOPES])).toEqual([]);
  });

  it("reports no conflicts for an empty selection", () => {
    expect(incompatibleScopePairs([])).toEqual([]);
  });
});
