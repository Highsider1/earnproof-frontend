import { apiClient, bearer, retryRead, retryMutation } from "./client";

/**
 * Issuer attestation lifecycle: creation, listing, and revocation.
 *
 * NOTE: `/issuers/{id}/attestations` is not yet defined in
 * `lib/api/openapi/earnproof-api.v1.json` — the backend does not expose
 * these endpoints today. This module follows the same request/response
 * conventions as the sibling `issuers.ts` client (REST resource under
 * `/issuers/{id}`, bearer auth, `apiClient` retry helpers) so it can be
 * wired up with no shape changes once the endpoints ship. Because the
 * schema isn't in the OpenAPI spec, it is deliberately NOT registered in
 * `lib/api/client-contracts.json` (that file is checked against the real
 * spec by `npm run test:contracts`).
 *
 * Privacy: the list response never includes the signed payload/credential
 * material for an attestation — only status metadata (subject hash, type,
 * status, timestamps). Anywhere a signed payload IS returned (creation
 * response), the UI must never persist it to browser storage (no local
 * storage, no session storage); see
 * `components/issuers/issuer-attestations.tsx`.
 */

export const ATTESTATION_TYPES = [
  "EMPLOYMENT",
  "IDENTITY_VERIFICATION",
  "INCOME_SOURCE",
] as const;
export type AttestationType = (typeof ATTESTATION_TYPES)[number];

export const ATTESTATION_STATUSES = ["ACTIVE", "EXPIRED", "REVOKED"] as const;
export type AttestationStatus = (typeof ATTESTATION_STATUSES)[number];

/**
 * Attestation metadata as listed. Deliberately excludes any signed
 * payload/credential material — only status metadata is ever listed, so
 * private payloads are never revealed by browsing the list.
 */
export type IssuerAttestation = {
  id: string;
  issuerId: string;
  subjectWalletHash: string;
  type: AttestationType;
  status: AttestationStatus;
  issuedAt: string;
  expiresAt: string;
  revokedAt?: string | null;
};

export type CreateAttestationRequest = {
  subjectWalletHash: string;
  type: AttestationType;
  expiresInDays: number;
};

/**
 * The one-time signed payload returned at creation. Callers must never
 * write `signedPayload` to any browser storage (local storage, session
 * storage, or IndexedDB) — display it in memory only, or let the user
 * export/copy it explicitly.
 */
export type CreateAttestationResponse = {
  attestation: IssuerAttestation;
  signedPayload: string;
};

export async function getIssuerAttestations(
  token: string,
  issuerId: string,
  signal: AbortSignal
): Promise<IssuerAttestation[]> {
  return retryRead(async (signal) => {
    return apiClient<IssuerAttestation[]>({
      path: `/issuers/${issuerId}/attestations`,
      method: "GET",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

export async function createIssuerAttestation(
  token: string,
  issuerId: string,
  request: CreateAttestationRequest,
  signal: AbortSignal
): Promise<CreateAttestationResponse> {
  return retryMutation(async (signal) => {
    return apiClient<CreateAttestationResponse>({
      path: `/issuers/${issuerId}/attestations`,
      method: "POST",
      headers: bearer(token),
      body: JSON.stringify(request),
      signal,
    });
  }, signal);
}

export async function revokeIssuerAttestation(
  token: string,
  issuerId: string,
  attestationId: string,
  signal: AbortSignal
): Promise<IssuerAttestation> {
  return retryMutation(async (signal) => {
    return apiClient<IssuerAttestation>({
      path: `/issuers/${issuerId}/attestations/${attestationId}/revoke`,
      method: "POST",
      headers: bearer(token),
      signal,
    });
  }, signal);
}

/**
 * Only an ACTIVE issuer may create attestations. This is a UI-level
 * pre-check to avoid a pointless round trip; the server must independently
 * reject creation requests from non-active issuers.
 */
export function canIssuerCreateAttestations(issuerStatus: string): boolean {
  return issuerStatus === "ACTIVE";
}

/**
 * Derives the effective status for display, treating an attestation whose
 * `expiresAt` has passed as expired even if the stored `status` value
 * hasn't caught up yet (e.g. a stale list fetched moments before expiry).
 * Revocation always takes precedence since it's a deliberate, permanent
 * action.
 */
export function getEffectiveAttestationStatus(
  attestation: Pick<IssuerAttestation, "status" | "expiresAt" | "revokedAt">,
  now: Date = new Date()
): AttestationStatus {
  if (attestation.status === "REVOKED" || attestation.revokedAt) {
    return "REVOKED";
  }
  if (new Date(attestation.expiresAt).getTime() <= now.getTime()) {
    return "EXPIRED";
  }
  return attestation.status;
}

export function formatAttestationType(type: AttestationType): string {
  switch (type) {
    case "EMPLOYMENT":
      return "Employment";
    case "IDENTITY_VERIFICATION":
      return "Identity Verification";
    case "INCOME_SOURCE":
      return "Income Source";
    default:
      return type;
  }
}

export function formatAttestationStatus(status: AttestationStatus): string {
  switch (status) {
    case "ACTIVE":
      return "Active";
    case "EXPIRED":
      return "Expired";
    case "REVOKED":
      return "Revoked";
    default:
      return status;
  }
}

export function getAttestationStatusTone(
  status: AttestationStatus
): "success" | "warning" | "accent" {
  switch (status) {
    case "ACTIVE":
      return "success";
    case "EXPIRED":
    case "REVOKED":
      return "warning";
    default:
      return "accent";
  }
}

/**
 * A Stellar-network wallet hash as used elsewhere in this app for
 * credential subjects (see `SignedCredential.subject.walletHash` in the
 * OpenAPI spec) — a `sha256:` prefixed hex digest, not a raw public key.
 */
export function validateSubjectWalletHash(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return "Subject wallet hash is required";
  }
  if (!/^sha256:[a-f0-9]{64}$/i.test(trimmed)) {
    return "Enter a valid wallet hash (sha256:<64 hex characters>)";
  }
  return null;
}
