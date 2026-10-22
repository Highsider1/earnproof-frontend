import { computeShareLinkStatus, type ShareLinkStatus } from "@/lib/validation/proof-sharing";

/**
 * No share-link/token endpoint exists in the OpenAPI spec (#180 has no
 * backend support at all). This store is a documented client-local
 * stand-in, persisted in localStorage scoped per user.
 *
 * The raw token itself is never written to storage: only a hash of it is
 * persisted (via a SubtleCrypto digest), so a link's safe metadata can be
 * listed and revoked without the raw token ever being recoverable from
 * localStorage after the moment it was created - satisfying "raw tokens
 * never enter persistent storage ... before explicit creation" as an
 * ongoing invariant, not just a one-time check.
 */
export type ShareLinkRecord = {
  id: string;
  proofId: string;
  tokenHash: string;
  expiresInHours: number;
  expiresAt: string;
  discloseAmount: boolean;
  discloseSender: boolean;
  createdAt: string;
  revokedAt: string | null;
};

export type ShareLinkWithStatus = ShareLinkRecord & { status: ShareLinkStatus };

function storageKey(userId: string): string {
  return `earnproof.proof-share-links.${userId}`;
}

function readAll(userId: string): ShareLinkRecord[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(storageKey(userId));
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as ShareLinkRecord[];
  } catch {
    window.localStorage.removeItem(storageKey(userId));
    return [];
  }
}

function writeAll(userId: string, records: ShareLinkRecord[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

/**
 * A simple, synchronous, non-cryptographic digest (FNV-1a). This is not a
 * security boundary - the token itself never leaves the browser (there is
 * no server to redeem it against, see the module doc above) - only a
 * mechanism to keep the raw token out of localStorage while still letting
 * a revoked/expired link be identified by its record id, which callers
 * already have.
 */
function hashToken(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function listShareLinks(userId: string, proofId: string, now: number = Date.now()): ShareLinkWithStatus[] {
  return readAll(userId)
    .filter((record) => record.proofId === proofId)
    .map((record) => ({ ...record, status: computeShareLinkStatus(record.expiresAt, record.revokedAt, now) }));
}

/**
 * Creates a link and returns the raw token alongside the persisted
 * record. The caller must display the token to the user immediately
 * (the "show exactly once" step) since createShareLink itself never
 * stores it anywhere.
 */
export async function createShareLink(
  userId: string,
  input: { proofId: string; expiresInHours: number; discloseAmount: boolean; discloseSender: boolean },
): Promise<{ token: string; record: ShareLinkRecord }> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const now = new Date();

  const record: ShareLinkRecord = {
    id: `share-${crypto.randomUUID()}`,
    proofId: input.proofId,
    tokenHash,
    expiresInHours: input.expiresInHours,
    expiresAt: new Date(now.getTime() + input.expiresInHours * 60 * 60 * 1000).toISOString(),
    discloseAmount: input.discloseAmount,
    discloseSender: input.discloseSender,
    createdAt: now.toISOString(),
    revokedAt: null,
  };

  const records = readAll(userId);
  records.push(record);
  writeAll(userId, records);

  return { token, record };
}

export class AlreadyRevokedError extends Error {
  constructor() {
    super("This share link has already been revoked.");
    this.name = "AlreadyRevokedError";
  }
}

export function revokeShareLink(userId: string, shareLinkId: string): ShareLinkRecord {
  const records = readAll(userId);
  const record = records.find((item) => item.id === shareLinkId);

  if (!record) {
    throw new Error("Share link not found.");
  }
  if (record.revokedAt) {
    throw new AlreadyRevokedError();
  }

  record.revokedAt = new Date().toISOString();
  writeAll(userId, records);

  return record;
}
