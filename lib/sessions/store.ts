/**
 * Active session inventory persistence (#158).
 *
 * No session-listing or remote-revocation endpoint exists in this repo's
 * OpenAPI spec: `/auth/challenge` and `/auth/verify` only issue a session,
 * they never enumerate a wallet's other active ones. This store is a
 * client-local stand-in — seeded per-user with deterministic "other
 * device" fixture entries plus the one real current session derived from
 * the actual stored session — so the UI is fully functional today, and
 * swapping in a real API client is a drop-in replacement for these
 * functions without touching the components that call them.
 *
 * Deliberately never persists or exposes: the raw session token, a full
 * User-Agent string, or an IP address — only a coarse device label (see
 * device-label.ts), createdAt, and lastUsedAt.
 */
import { labelDevice } from "./device-label";

const STORAGE_KEY_PREFIX = "earnproof.sessions.";

export interface SessionRecord {
  id: string;
  deviceLabel: string;
  createdAt: string;
  lastUsedAt: string;
  /** True for the session backing the browser tab that's rendering the UI. */
  isCurrent: boolean;
  revokedAt: string | null;
}

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isSessionRecord(value: unknown): value is SessionRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.deviceLabel === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.lastUsedAt === "string" &&
    typeof r.isCurrent === "boolean" &&
    (r.revokedAt === null || typeof r.revokedAt === "string")
  );
}

function readRaw(userId: string): SessionRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSessionRecord);
  } catch {
    return [];
  }
}

function writeRaw(userId: string, records: SessionRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

function currentUserAgent(): string {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent;
}

/**
 * Deterministic fixture "other device" sessions, seeded once per user on
 * first read. Fixed relative offsets (not Math.random) keep test output
 * and demo behavior reproducible.
 */
function seedOtherSessions(now: number): SessionRecord[] {
  return [
    {
      id: "seed-1",
      deviceLabel: "iOS - Safari",
      createdAt: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
      isCurrent: false,
      revokedAt: null,
    },
    {
      id: "seed-2",
      deviceLabel: "Windows - Edge",
      createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString(),
      lastUsedAt: new Date(now - 20 * 24 * 60 * 60 * 1000).toISOString(),
      isCurrent: false,
      revokedAt: null,
    },
  ];
}

/**
 * Lists active sessions for a user: the real current session (derived
 * live from the actual browser context, never stored as fixture data)
 * plus this user's persisted "other device" sessions, seeding the fixture
 * set on first access. Revoked sessions are excluded — see
 * listRecentlyRevokedSessions for those.
 */
export function listActiveSessions(userId: string): SessionRecord[] {
  let others = readRaw(userId);
  if (others.length === 0) {
    others = seedOtherSessions(Date.now());
    writeRaw(userId, others);
  }

  const current: SessionRecord = {
    id: `current-${userId}`,
    deviceLabel: labelDevice(currentUserAgent()),
    createdAt: new Date().toISOString(),
    lastUsedAt: new Date().toISOString(),
    isCurrent: true,
    revokedAt: null,
  };

  return [current, ...others.filter((s) => s.revokedAt === null)];
}

export function listRecentlyRevokedSessions(userId: string): SessionRecord[] {
  return readRaw(userId).filter((s) => s.revokedAt !== null);
}

export class SessionNotFoundError extends Error {
  constructor(id: string) {
    super(`Session ${id} not found`);
    this.name = "SessionNotFoundError";
  }
}

export class CannotRevokeCurrentSessionError extends Error {
  constructor() {
    super("The current session cannot be revoked from this list. Use sign out instead.");
    this.name = "CannotRevokeCurrentSessionError";
  }
}

/**
 * Revokes a single non-current session by id. Treats an already-revoked
 * session the same as a missing one (SessionNotFoundError) rather than
 * silently re-stamping revokedAt, so a second caller racing to revoke the
 * same session (e.g. two open tabs) gets a clear "this is already gone"
 * signal instead of appearing to succeed twice.
 */
export function revokeSession(userId: string, id: string): void {
  if (id === `current-${userId}`) {
    throw new CannotRevokeCurrentSessionError();
  }
  const records = readRaw(userId);
  const index = records.findIndex((s) => s.id === id && s.revokedAt === null);
  if (index === -1) {
    throw new SessionNotFoundError(id);
  }
  records[index] = { ...records[index]!, revokedAt: new Date().toISOString() };
  writeRaw(userId, records);
}

/** Revokes every non-current session for a user. Returns the count revoked. */
export function revokeAllOtherSessions(userId: string): number {
  const records = readRaw(userId);
  const now = new Date().toISOString();
  let count = 0;
  const updated = records.map((s) => {
    if (s.revokedAt === null) {
      count += 1;
      return { ...s, revokedAt: now };
    }
    return s;
  });
  writeRaw(userId, updated);
  return count;
}
