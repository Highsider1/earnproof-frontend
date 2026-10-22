import {
  listTrustedSources,
  createTrustedSource,
  updateTrustedSource,
  deleteTrustedSource,
  TrustedSourceNotFoundError,
} from "../store";

const USER_A = "user-a";
const USER_B = "user-b";

beforeEach(() => {
  window.localStorage.clear();
});

describe("trusted-sources store", () => {
  it("returns an empty list for a user with no trusted sources", () => {
    expect(listTrustedSources(USER_A)).toEqual([]);
  });

  it("creates a trusted source and returns it with generated id/timestamps", () => {
    const record = createTrustedSource(USER_A, { name: "Acme Payroll", issuerId: "iss-1" });

    expect(record.id).toBeTruthy();
    expect(record.name).toBe("Acme Payroll");
    expect(record.issuerId).toBe("iss-1");
    expect(record.createdAt).toBe(record.updatedAt);
  });

  it("trims the name on create", () => {
    const record = createTrustedSource(USER_A, { name: "  Padded Name  ", issuerId: "iss-1" });
    expect(record.name).toBe("Padded Name");
  });

  it("lists created sources newest first", () => {
    const first = createTrustedSource(USER_A, { name: "First", issuerId: "iss-1" });
    // Force a distinguishable timestamp for ordering.
    const second = { ...createTrustedSource(USER_A, { name: "Second", issuerId: "iss-2" }) };

    const list = listTrustedSources(USER_A);
    expect(list.map((r) => r.id)).toContain(first.id);
    expect(list.map((r) => r.id)).toContain(second.id);
  });

  it("scopes trusted sources per user", () => {
    createTrustedSource(USER_A, { name: "A's source", issuerId: "iss-1" });
    createTrustedSource(USER_B, { name: "B's source", issuerId: "iss-2" });

    expect(listTrustedSources(USER_A)).toHaveLength(1);
    expect(listTrustedSources(USER_B)).toHaveLength(1);
    expect(listTrustedSources(USER_A)[0]?.name).toBe("A's source");
  });

  it("updates name and issuerId", () => {
    const record = createTrustedSource(USER_A, { name: "Original", issuerId: "iss-1" });

    const updated = updateTrustedSource(USER_A, record.id, {
      name: "Renamed",
      issuerId: "iss-2",
    });

    expect(updated.name).toBe("Renamed");
    expect(updated.issuerId).toBe("iss-2");
    expect(updated.id).toBe(record.id);
  });

  it("partially updates, leaving unspecified fields unchanged", () => {
    const record = createTrustedSource(USER_A, { name: "Original", issuerId: "iss-1" });

    const updated = updateTrustedSource(USER_A, record.id, { name: "Renamed only" });

    expect(updated.name).toBe("Renamed only");
    expect(updated.issuerId).toBe("iss-1");
  });

  it("throws TrustedSourceNotFoundError when updating a missing id", () => {
    expect(() => updateTrustedSource(USER_A, "does-not-exist", { name: "x" })).toThrow(
      TrustedSourceNotFoundError,
    );
  });

  it("throws when updating a source that belongs to a different user", () => {
    const record = createTrustedSource(USER_A, { name: "A's source", issuerId: "iss-1" });

    expect(() => updateTrustedSource(USER_B, record.id, { name: "hijacked" })).toThrow(
      TrustedSourceNotFoundError,
    );
  });

  it("deletes a trusted source", () => {
    const record = createTrustedSource(USER_A, { name: "To delete", issuerId: "iss-1" });

    deleteTrustedSource(USER_A, record.id);

    expect(listTrustedSources(USER_A)).toHaveLength(0);
  });

  it("delete is idempotent for a missing id", () => {
    expect(() => deleteTrustedSource(USER_A, "does-not-exist")).not.toThrow();
  });

  it("deleting under one user's id does not affect another user's records", () => {
    const record = createTrustedSource(USER_A, { name: "A's source", issuerId: "iss-1" });

    deleteTrustedSource(USER_B, record.id);

    expect(listTrustedSources(USER_A)).toHaveLength(1);
  });

  it("discards a corrupted (non-array) stored value instead of throwing", () => {
    window.localStorage.setItem(`earnproof.trusted-sources.${USER_A}`, JSON.stringify({ not: "an array" }));

    expect(listTrustedSources(USER_A)).toEqual([]);
  });

  it("discards malformed entries within an otherwise-valid array", () => {
    window.localStorage.setItem(
      `earnproof.trusted-sources.${USER_A}`,
      JSON.stringify([{ id: "ok", name: "Valid", issuerId: "iss-1", createdAt: "x", updatedAt: "x" }, { garbage: true }]),
    );

    const list = listTrustedSources(USER_A);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("ok");
  });

  it("recovers from non-JSON localStorage content without throwing", () => {
    window.localStorage.setItem(`earnproof.trusted-sources.${USER_A}`, "{not json");

    expect(() => listTrustedSources(USER_A)).not.toThrow();
    expect(listTrustedSources(USER_A)).toEqual([]);
  });
});
