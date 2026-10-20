/**
 * Signed deployment metadata verification (#185).
 *
 * Disclosed scope gap: there is no deployment-metadata endpoint anywhere in
 * this API's OpenAPI spec (lib/api/openapi/earnproof-api.v1.json only has
 * /health, which carries no network/contract/version/signature fields).
 * Following this repo's own precedent for a similar gap (#141's PR disclosed
 * a missing contract-sync endpoint rather than fabricating one), this module
 * defines the client's expected contract for that endpoint
 * (DeploymentMetadataDocument below) and implements the verification logic
 * against it, but the actual backend endpoint (GET /deployment/metadata,
 * assumed here) does not exist yet and needs to be added to the API before
 * this can run against a real deployment.
 *
 * The document is signed with Ed25519 (the same signature scheme Stellar
 * keypairs use) by a dedicated deployment-metadata signing key
 * (appConfig.deploymentMetadataSignerPublicKey) - NOT a Stellar account, and
 * unrelated to any wallet's signing key. Verification uses @noble/ed25519
 * (this project's first crypto dependency; there is no Ed25519 support in
 * browsers' native SubtleCrypto) plus lib/stellar/strkey.ts to decode the
 * signer's "G..." address into the raw public key @noble/ed25519 needs.
 */

import { verifyAsync } from "@noble/ed25519";
import { appConfig } from "@/config/app";
import { decodeEd25519PublicKey } from "@/lib/stellar/strkey";
import { apiClient } from "@/lib/api/client";

/**
 * The signed document's shape, as this client expects it. `signature` is a
 * base64-encoded Ed25519 signature over the canonical JSON serialization of
 * every other field (see `canonicalPayload` below) - not the whole document
 * including the signature itself, so the server can compute it once. `issuedAt`
 * lets stale-metadata detection work without needing a separate freshness field.
 */
export interface DeploymentMetadataDocument {
  networkPassphrase: string;
  contractAddresses: string[];
  artifactVersion: string;
  issuedAt: string; // ISO date-time
  signature: string; // base64 Ed25519 signature
}

export type DeploymentMetadataState =
  | { status: "valid"; metadata: DeploymentMetadataDocument }
  | { status: "stale"; metadata: DeploymentMetadataDocument; ageMs: number }
  | {
      status: "mismatched";
      metadata: DeploymentMetadataDocument;
      mismatches: DeploymentMismatch[];
    }
  | { status: "malformed"; reason: string }
  | { status: "unavailable"; reason: string };

export interface DeploymentMismatch {
  field: "networkPassphrase" | "contractAddresses" | "artifactVersion";
  expected: string | string[];
  actual: string | string[];
}

/**
 * How old a signed document may be before it's treated as stale rather than
 * valid. The document has no backend-declared TTL (there's no field for one
 * in the shape above, since no real endpoint exists to define it), so this
 * is a documented client-side default, the same approach lib/auth/recent-auth.ts
 * takes for RECENT_AUTH_WINDOW_MS.
 */
export const DEPLOYMENT_METADATA_MAX_AGE_MS = 15 * 60 * 1000; // 15 minutes

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/**
 * Validates the shape of a raw API response before trusting any of its
 * fields, so a malformed or partially-shaped payload is rejected outright
 * rather than read field-by-field with optional chaining (which would let a
 * missing field silently become `undefined` and pass a mismatch check it
 * shouldn't).
 */
function parseDocument(raw: unknown): DeploymentMetadataDocument | null {
  if (!isRecord(raw)) return null;

  const { networkPassphrase, contractAddresses, artifactVersion, issuedAt, signature } = raw;

  if (
    typeof networkPassphrase !== "string" ||
    !isStringArray(contractAddresses) ||
    typeof artifactVersion !== "string" ||
    typeof issuedAt !== "string" ||
    typeof signature !== "string" ||
    Number.isNaN(new Date(issuedAt).getTime())
  ) {
    return null;
  }

  return { networkPassphrase, contractAddresses, artifactVersion, issuedAt, signature };
}

/**
 * The exact bytes the signature covers: every field except `signature`
 * itself, serialized with a fixed key order so the client's recomputation
 * always matches what the server signed regardless of the raw JSON's own
 * key order or whitespace.
 */
function canonicalPayload(metadata: Omit<DeploymentMetadataDocument, "signature">): Uint8Array {
  const canonical = JSON.stringify({
    networkPassphrase: metadata.networkPassphrase,
    contractAddresses: metadata.contractAddresses,
    artifactVersion: metadata.artifactVersion,
    issuedAt: metadata.issuedAt,
  });
  return new TextEncoder().encode(canonical);
}

function base64ToBytes(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function verifyDocumentSignature(metadata: DeploymentMetadataDocument): Promise<boolean> {
  const signerKey = decodeEd25519PublicKey(appConfig.deploymentMetadataSignerPublicKey);
  const signatureBytes = base64ToBytes(metadata.signature);

  // No configured signer key, or a malformed signature: never treat this as
  // "verification skipped, assume valid" - fail closed instead.
  if (!signerKey || !signatureBytes || signatureBytes.length !== 64) {
    return false;
  }

  try {
    return await verifyAsync(signatureBytes, canonicalPayload(metadata), signerKey);
  } catch {
    return false;
  }
}

function findMismatches(metadata: DeploymentMetadataDocument): DeploymentMismatch[] {
  const mismatches: DeploymentMismatch[] = [];

  if (metadata.networkPassphrase !== appConfig.stellarNetworkPassphrase) {
    mismatches.push({
      field: "networkPassphrase",
      expected: appConfig.stellarNetworkPassphrase,
      actual: metadata.networkPassphrase,
    });
  }

  const expectedContracts = [...appConfig.expectedContractAddresses].sort();
  const actualContracts = [...metadata.contractAddresses].sort();
  if (JSON.stringify(expectedContracts) !== JSON.stringify(actualContracts)) {
    mismatches.push({
      field: "contractAddresses",
      expected: appConfig.expectedContractAddresses,
      actual: metadata.contractAddresses,
    });
  }

  if (metadata.artifactVersion !== appConfig.artifactVersion) {
    mismatches.push({
      field: "artifactVersion",
      expected: appConfig.artifactVersion,
      actual: metadata.artifactVersion,
    });
  }

  return mismatches;
}

/**
 * Fetches and verifies the signed deployment-metadata document, returning
 * one of five states (#185's acceptance criteria): valid, stale, mismatched,
 * malformed, or unavailable. Never throws - every failure path (network
 * error, bad JSON, bad signature, missing signer key) resolves to a state
 * the caller can render and block on, per "no unsigned fallback is accepted
 * in production."
 */
export async function verifyDeploymentMetadata(
  signal?: AbortSignal,
): Promise<DeploymentMetadataState> {
  let raw: unknown;
  try {
    raw = await apiClient<unknown>({
      path: "/deployment/metadata",
      method: "GET",
      signal,
    });
  } catch {
    return { status: "unavailable", reason: "Could not reach the deployment metadata endpoint." };
  }

  const metadata = parseDocument(raw);
  if (!metadata) {
    return { status: "malformed", reason: "The deployment metadata document is not well-formed." };
  }

  const signatureValid = await verifyDocumentSignature(metadata);
  if (!signatureValid) {
    return { status: "malformed", reason: "The deployment metadata document's signature is invalid." };
  }

  const ageMs = Date.now() - new Date(metadata.issuedAt).getTime();
  if (ageMs > DEPLOYMENT_METADATA_MAX_AGE_MS) {
    return { status: "stale", metadata, ageMs };
  }

  const mismatches = findMismatches(metadata);
  if (mismatches.length > 0) {
    return { status: "mismatched", metadata, mismatches };
  }

  return { status: "valid", metadata };
}

/** Whether a verification result should block the workflow that requested it. */
export function blocksProtectedWorkflow(state: DeploymentMetadataState): boolean {
  return state.status !== "valid";
}
