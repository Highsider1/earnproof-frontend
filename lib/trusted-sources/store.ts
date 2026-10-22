/**
 * Trusted-source persistence (#135).
 *
 * There is no trusted-source CRUD endpoint in this repo's OpenAPI spec
 * (lib/api/openapi/earnproof-api.v1.json only has issuers, organizations,
 * api-keys, payments, and proofs). This store is a client-local stand-in —
 * localStorage, scoped per authenticated user — so the management UI is
 * fully functional today, and swapping in a real `lib/api/trusted-sources.ts`
 * client later is a drop-in replacement for this module's functions without
 * touching the components that call them.
 *
 * Issuer *linkage* itself is real: a trusted source's issuerId is validated
 * against the live GET /issuers list at creation time (see
 * trusted-source-management.tsx), not invented here.
 */

const STORAGE_KEY_PREFIX = "earnproof.trusted-sources.";

export interface TrustedSourceRecord {
  id: string;
  name: string;
  issuerId: string;
  createdAt: string;
  updatedAt: string;
}

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function readAll(userId: string): TrustedSourceRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isTrustedSourceRecord);
  } catch {
    return [];
  }
}

function writeAll(userId: string, records: TrustedSourceRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

function isTrustedSourceRecord(value: unknown): value is TrustedSourceRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.name === "string" &&
    typeof r.issuerId === "string" &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

export function listTrustedSources(userId: string): TrustedSourceRecord[] {
  return readAll(userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createTrustedSource(
  userId: string,
  input: { name: string; issuerId: string },
): TrustedSourceRecord {
  const now = new Date().toISOString();
  const record: TrustedSourceRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `ts_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    name: input.name.trim(),
    issuerId: input.issuerId,
    createdAt: now,
    updatedAt: now,
  };
  const records = readAll(userId);
  records.push(record);
  writeAll(userId, records);
  return record;
}

export class TrustedSourceNotFoundError extends Error {
  constructor(id: string) {
    super(`Trusted source ${id} not found`);
    this.name = "TrustedSourceNotFoundError";
  }
}

export function updateTrustedSource(
  userId: string,
  id: string,
  patch: { name?: string; issuerId?: string },
): TrustedSourceRecord {
  const records = readAll(userId);
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new TrustedSourceNotFoundError(id);
  }
  const existing = records[index]!;
  const updated: TrustedSourceRecord = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    issuerId: patch.issuerId ?? existing.issuerId,
    updatedAt: new Date().toISOString(),
  };
  records[index] = updated;
  writeAll(userId, records);
  return updated;
}

export function deleteTrustedSource(userId: string, id: string): void {
  const records = readAll(userId);
  writeAll(
    userId,
    records.filter((r) => r.id !== id),
  );
}
