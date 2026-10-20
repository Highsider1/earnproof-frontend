/**
 * Proof renewal and supersession linkage (#168).
 *
 * There is no supersession/renewal field anywhere in this repo's proof
 * schemas (ProofListItem, SignedCredential, ProofSummary) or its OpenAPI
 * spec — renewing means creating an entirely new proof via the existing
 * real proof-creation endpoints (POST /proofs/minimum-income etc.) and
 * remembering the predecessor -> successor relationship, since the backend
 * has nowhere to store that link. This store is that client-local linkage
 * layer, persisted per user; it never mutates or revokes the predecessor
 * proof itself, which is the whole point — "the predecessor remains
 * independently verifiable" (#168's own acceptance criterion) requires
 * leaving it exactly as the backend already has it.
 */

const STORAGE_KEY_PREFIX = "earnproof.proof-renewals.";

export interface RenewalLinkRecord {
  id: string;
  predecessorId: string;
  successorId: string;
  createdAt: string;
}

function storageKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function isRenewalLinkRecord(value: unknown): value is RenewalLinkRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.predecessorId === "string" &&
    typeof r.successorId === "string" &&
    typeof r.createdAt === "string"
  );
}

function readAll(userId: string): RenewalLinkRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRenewalLinkRecord);
  } catch {
    return [];
  }
}

function writeAll(userId: string, records: RenewalLinkRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(records));
}

export function listRenewalLinks(userId: string): RenewalLinkRecord[] {
  return readAll(userId);
}

/** The successor a proof was renewed into, if any. */
export function findSuccessorOf(userId: string, proofId: string): RenewalLinkRecord | null {
  return readAll(userId).find((link) => link.predecessorId === proofId) ?? null;
}

/** The predecessor a proof was renewed from, if any. */
export function findPredecessorOf(userId: string, proofId: string): RenewalLinkRecord | null {
  return readAll(userId).find((link) => link.successorId === proofId) ?? null;
}

export class DuplicateSuccessorError extends Error {
  constructor() {
    super("This proof has already been renewed; a proof can only have one successor");
    this.name = "DuplicateSuccessorError";
  }
}

export class RenewalCycleError extends Error {
  constructor() {
    super("This renewal would create a cycle in the predecessor/successor chain");
    this.name = "RenewalCycleError";
  }
}

/**
 * Records that `successorId` renews `predecessorId`. Blocks two failure
 * modes #168 explicitly calls out:
 *  - Duplicate successor submissions: a predecessor that already has a
 *    successor cannot be renewed again (retry-safe: the caller should
 *    treat an existing link for the same pair as success, not call this
 *    twice for the same successor).
 *  - Cycles: walking the successor's own predecessor chain must never
 *    reach back to `predecessorId` (or `successorId` itself), which would
 *    make A supersede B supersede A.
 */
export function recordRenewal(
  userId: string,
  predecessorId: string,
  successorId: string,
): RenewalLinkRecord {
  if (predecessorId === successorId) {
    throw new RenewalCycleError();
  }

  const records = readAll(userId);

  const existingSuccessor = records.find((link) => link.predecessorId === predecessorId);
  if (existingSuccessor) {
    throw new DuplicateSuccessorError();
  }

  // Walk predecessorId's own chain backward (predecessor of predecessor of
  // ...); if it ever reaches successorId, linking would close a cycle.
  let cursor: string | null = predecessorId;
  const visited = new Set<string>();
  while (cursor) {
    if (visited.has(cursor)) break; // already-corrupt chain; don't loop forever
    visited.add(cursor);
    const link: RenewalLinkRecord | undefined = records.find((l) => l.successorId === cursor);
    if (!link) break;
    if (link.predecessorId === successorId) {
      throw new RenewalCycleError();
    }
    cursor = link.predecessorId;
  }

  const record: RenewalLinkRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `renewal_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    predecessorId,
    successorId,
    createdAt: new Date().toISOString(),
  };
  records.push(record);
  writeAll(userId, records);
  return record;
}
