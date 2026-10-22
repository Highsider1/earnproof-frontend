/**
 * Wallet address rotation tracking (#169).
 *
 * No rotation-completion endpoint exists in this repo's OpenAPI spec: only
 * /auth/challenge and /auth/verify are real, and both only ever authenticate
 * a session for whatever wallet address is already presented — neither one
 * reassigns which wallet an *existing* account is tied to. This store
 * layers a client-local rotation record on top of two real challenge/verify
 * round trips (one for the current wallet, one for the replacement), so
 * the "replacement not already assigned" and "no rotation completes after
 * either proof expires" checks this issue asks for have somewhere to live.
 * The actual identity reassignment recorded here would need a real backend
 * mutation once one exists; this store's function signatures are the
 * intended drop-in target for that.
 */

const STORAGE_KEY = "earnproof.wallet-rotations";

export interface WalletRotationRecord {
  id: string;
  previousAddress: string;
  newAddress: string;
  completedAt: string;
}

function isWalletRotationRecord(value: unknown): value is WalletRotationRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.previousAddress === "string" &&
    typeof r.newAddress === "string" &&
    typeof r.completedAt === "string"
  );
}

function readAll(): WalletRotationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWalletRotationRecord);
  } catch {
    return [];
  }
}

function writeAll(records: WalletRotationRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listWalletRotations(): WalletRotationRecord[] {
  return readAll();
}

/**
 * True if `address` is already the *current* address of a completed
 * rotation (i.e. some other account has already rotated into it) —
 * #169's "replacement address ... not already assigned" acceptance
 * criterion. Only checks addresses that are a rotation *target*; being a
 * rotation's old/previous address does not block reuse, since that wallet
 * is exactly the one being vacated.
 */
export function isWalletAlreadyAssigned(address: string): boolean {
  return readAll().some((r) => r.newAddress === address);
}

export class WalletAlreadyAssignedError extends Error {
  constructor() {
    super("This wallet address is already assigned to another account.");
    this.name = "WalletAlreadyAssignedError";
  }
}

export function completeWalletRotation(
  previousAddress: string,
  newAddress: string,
): WalletRotationRecord {
  if (isWalletAlreadyAssigned(newAddress)) {
    throw new WalletAlreadyAssignedError();
  }

  const record: WalletRotationRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `rotation_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    previousAddress,
    newAddress,
    completedAt: new Date().toISOString(),
  };
  const records = readAll();
  records.push(record);
  writeAll(records);
  return record;
}

/**
 * True while both the current-wallet and replacement-wallet challenges are
 * still within their expiry window (#169's "No rotation completes after
 * either proof expires"). Pass the two AuthChallenge.expiresAt values.
 */
export function areBothChallengesValid(
  currentExpiresAt: string,
  replacementExpiresAt: string,
  now: number = Date.now(),
): boolean {
  const currentExpiry = Date.parse(currentExpiresAt);
  const replacementExpiry = Date.parse(replacementExpiresAt);
  if (Number.isNaN(currentExpiry) || Number.isNaN(replacementExpiry)) return false;
  return now < currentExpiry && now < replacementExpiry;
}
