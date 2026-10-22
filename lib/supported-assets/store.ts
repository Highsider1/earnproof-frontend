/**
 * Supported-asset registry persistence (#156).
 *
 * There is no supported-asset CRUD endpoint in this repo's OpenAPI spec
 * (see lib/validation/supported-assets.ts's header for the full endpoint
 * inventory). This store is a client-local stand-in — localStorage, shared
 * across the organization rather than per-user, since asset policy is an
 * org-wide setting, not personal data — so the management UI is fully
 * functional today, and swapping in a real API client is a drop-in
 * replacement without touching the components that call these functions.
 */
import { assetIdentityKey } from "@/lib/validation/supported-assets";

const STORAGE_KEY = "earnproof.supported-assets";

export type SupportedAssetStatus = "ACTIVE" | "INACTIVE";

export interface SupportedAssetRecord {
  id: string;
  assetCode: string;
  assetIssuer: string | null;
  network: "testnet" | "mainnet";
  status: SupportedAssetStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Set once an asset is deactivated so historical references (proofs,
   * payments already indexed under it) remain identifiable even though the
   * asset is no longer active for new use (#156's "Historical assets
   * remain identifiable after deactivation" acceptance criterion).
   */
  deactivatedAt: string | null;
}

function isSupportedAssetRecord(value: unknown): value is SupportedAssetRecord {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.assetCode === "string" &&
    (r.assetIssuer === null || typeof r.assetIssuer === "string") &&
    (r.network === "testnet" || r.network === "mainnet") &&
    (r.status === "ACTIVE" || r.status === "INACTIVE") &&
    typeof r.createdAt === "string" &&
    typeof r.updatedAt === "string"
  );
}

function readAll(): SupportedAssetRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isSupportedAssetRecord);
  } catch {
    return [];
  }
}

function writeAll(records: SupportedAssetRecord[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function listSupportedAssets(): SupportedAssetRecord[] {
  return readAll().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export class DuplicateSupportedAssetError extends Error {
  constructor() {
    super("A supported asset with this network, code, and issuer already exists");
    this.name = "DuplicateSupportedAssetError";
  }
}

export function createSupportedAsset(input: {
  assetCode: string;
  assetIssuer?: string;
  network: "testnet" | "mainnet";
}): SupportedAssetRecord {
  const records = readAll();
  const key = assetIdentityKey(input);
  const isDuplicate = records.some(
    (r) => assetIdentityKey({ network: r.network, assetCode: r.assetCode, assetIssuer: r.assetIssuer }) === key,
  );
  if (isDuplicate) {
    throw new DuplicateSupportedAssetError();
  }

  const now = new Date().toISOString();
  const record: SupportedAssetRecord = {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `asset_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    assetCode: input.assetCode.toUpperCase(),
    assetIssuer: input.assetIssuer ?? null,
    network: input.network,
    status: "ACTIVE",
    createdAt: now,
    updatedAt: now,
    deactivatedAt: null,
  };
  records.push(record);
  writeAll(records);
  return record;
}

export class SupportedAssetNotFoundError extends Error {
  constructor(id: string) {
    super(`Supported asset ${id} not found`);
    this.name = "SupportedAssetNotFoundError";
  }
}

export function updateSupportedAsset(
  id: string,
  patch: { assetCode?: string },
): SupportedAssetRecord {
  const records = readAll();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new SupportedAssetNotFoundError(id);
  }
  const existing = records[index]!;
  const updated: SupportedAssetRecord = {
    ...existing,
    assetCode: patch.assetCode !== undefined ? patch.assetCode.toUpperCase() : existing.assetCode,
    updatedAt: new Date().toISOString(),
  };
  records[index] = updated;
  writeAll(records);
  return updated;
}

export function setSupportedAssetStatus(
  id: string,
  status: SupportedAssetStatus,
): SupportedAssetRecord {
  const records = readAll();
  const index = records.findIndex((r) => r.id === id);
  if (index === -1) {
    throw new SupportedAssetNotFoundError(id);
  }
  const existing = records[index]!;
  const now = new Date().toISOString();
  const updated: SupportedAssetRecord = {
    ...existing,
    status,
    updatedAt: now,
    // deactivatedAt is set once and never cleared by a later reactivation,
    // so "was this ever deactivated" stays answerable for historical
    // reference even after the asset becomes active again.
    deactivatedAt: status === "INACTIVE" ? now : existing.deactivatedAt,
  };
  records[index] = updated;
  writeAll(records);
  return updated;
}
