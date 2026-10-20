import {
  listActiveSessions,
  listRecentlyRevokedSessions,
  revokeSession,
  revokeAllOtherSessions,
  SessionNotFoundError,
  CannotRevokeCurrentSessionError,
} from "../store";

const USER_A = "user-a";
const USER_B = "user-b";

beforeEach(() => {
  window.localStorage.clear();
});

describe("sessions store", () => {
  it("always includes exactly one current session", () => {
    const sessions = listActiveSessions(USER_A);
    const currentSessions = sessions.filter((s) => s.isCurrent);
    expect(currentSessions).toHaveLength(1);
  });

  it("seeds deterministic other-device sessions on first access", () => {
    const sessions = listActiveSessions(USER_A);
    expect(sessions.length).toBeGreaterThan(1);
  });

  it("does not re-seed on a second access (idempotent)", () => {
    const first = listActiveSessions(USER_A);
    const second = listActiveSessions(USER_A);
    expect(second.filter((s) => !s.isCurrent).map((s) => s.id)).toEqual(
      first.filter((s) => !s.isCurrent).map((s) => s.id),
    );
  });

  it("scopes sessions per user", () => {
    const a = listActiveSessions(USER_A);
    const b = listActiveSessions(USER_B);
    const aOtherIds = a.filter((s) => !s.isCurrent).map((s) => s.id);
    const bOtherIds = b.filter((s) => !s.isCurrent).map((s) => s.id);
    // Both users get the same seed fixture ids, but stored under separate
    // per-user keys — revoking one user's session must not touch the other.
    revokeAllOtherSessions(USER_A);
    expect(listActiveSessions(USER_A).filter((s) => !s.isCurrent)).toHaveLength(0);
    expect(listActiveSessions(USER_B).filter((s) => !s.isCurrent)).toHaveLength(
      bOtherIds.length,
    );
    expect(aOtherIds.length).toBeGreaterThan(0);
  });

  it("never exposes a raw token field on any session", () => {
    const sessions = listActiveSessions(USER_A);
    for (const session of sessions) {
      expect(session).not.toHaveProperty("token");
    }
  });

  it("revokes a single non-current session", () => {
    const sessions = listActiveSessions(USER_A);
    const target = sessions.find((s) => !s.isCurrent)!;

    revokeSession(USER_A, target.id);

    const after = listActiveSessions(USER_A);
    expect(after.find((s) => s.id === target.id)).toBeUndefined();
  });

  it("moves a revoked session into the recently-revoked list", () => {
    const sessions = listActiveSessions(USER_A);
    const target = sessions.find((s) => !s.isCurrent)!;

    revokeSession(USER_A, target.id);

    const revoked = listRecentlyRevokedSessions(USER_A);
    expect(revoked.map((s) => s.id)).toContain(target.id);
    expect(revoked.find((s) => s.id === target.id)?.revokedAt).not.toBeNull();
  });

  it("refuses to revoke the current session", () => {
    listActiveSessions(USER_A);
    expect(() => revokeSession(USER_A, `current-${USER_A}`)).toThrow(
      CannotRevokeCurrentSessionError,
    );
  });

  it("does not end the current session when revoking another one (regression)", () => {
    const before = listActiveSessions(USER_A);
    const target = before.find((s) => !s.isCurrent)!;

    revokeSession(USER_A, target.id);

    const after = listActiveSessions(USER_A);
    expect(after.some((s) => s.isCurrent)).toBe(true);
  });

  it("throws SessionNotFoundError for a missing id", () => {
    expect(() => revokeSession(USER_A, "does-not-exist")).toThrow(SessionNotFoundError);
  });

  it("revoking an already-revoked session again throws SessionNotFoundError (concurrently-revoked case)", () => {
    const sessions = listActiveSessions(USER_A);
    const target = sessions.find((s) => !s.isCurrent)!;

    revokeSession(USER_A, target.id);

    expect(() => revokeSession(USER_A, target.id)).toThrow(SessionNotFoundError);
  });

  it("revokes all other sessions in bulk and returns the count revoked", () => {
    const sessions = listActiveSessions(USER_A);
    const otherCount = sessions.filter((s) => !s.isCurrent).length;

    const revokedCount = revokeAllOtherSessions(USER_A);

    expect(revokedCount).toBe(otherCount);
    expect(listActiveSessions(USER_A).filter((s) => !s.isCurrent)).toHaveLength(0);
  });

  it("bulk revoke does not end the current session", () => {
    listActiveSessions(USER_A);
    revokeAllOtherSessions(USER_A);

    const after = listActiveSessions(USER_A);
    expect(after.some((s) => s.isCurrent)).toBe(true);
  });

  it("bulk revoke is idempotent (revoking twice does not double-count)", () => {
    listActiveSessions(USER_A);
    revokeAllOtherSessions(USER_A);

    const secondRevokeCount = revokeAllOtherSessions(USER_A);

    expect(secondRevokeCount).toBe(0);
  });

  it("discards a corrupted (non-array) stored value instead of throwing", () => {
    window.localStorage.setItem(
      "earnproof.sessions.user-a",
      JSON.stringify({ not: "array" }),
    );

    expect(() => listActiveSessions(USER_A)).not.toThrow();
  });
});
