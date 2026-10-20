import type { GapPolicy } from "@/lib/validation/employment-continuity-proofs";

/**
 * No POST /proofs/employment-continuity (or any employment-continuity
 * schema) exists in the OpenAPI spec (#164 has no backend support at all).
 * This store is a documented client-side stand-in: it persists the created
 * proof record in localStorage, scoped per user, so the wizard has
 * something real to create/list/confirm against in the meantime.
 */
export type PeriodCoverage = {
  start: string;
  end: string;
  covered: boolean;
  qualifyingPaymentCount: number;
};

export type EmploymentContinuityProof = {
  id: string;
  userId: string;
  continuityLengthMonths: number;
  gapPolicy: GapPolicy;
  periodStart: string;
  periodEnd: string;
  assetCode: string;
  assetIssuer: string | null;
  totalPeriods: number;
  coveredPeriods: number;
  missingPeriods: Array<{ start: string; end: string }>;
  expiresInDays: number;
  createdAt: string;
  expiresAt: string;
};

function storageKey(userId: string): string {
  return `earnproof.employment-continuity-proofs.${userId}`;
}

function readAll(userId: string): EmploymentContinuityProof[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(storageKey(userId));
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as EmploymentContinuityProof[];
  } catch {
    window.localStorage.removeItem(storageKey(userId));
    return [];
  }
}

function writeAll(userId: string, proofs: EmploymentContinuityProof[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(storageKey(userId), JSON.stringify(proofs));
}

export function listEmploymentContinuityProofs(userId: string): EmploymentContinuityProof[] {
  return readAll(userId);
}

export function createEmploymentContinuityProof(
  userId: string,
  input: {
    continuityLengthMonths: number;
    gapPolicy: GapPolicy;
    periodStart: string;
    periodEnd: string;
    assetCode: string;
    assetIssuer: string | null;
    totalPeriods: number;
    coveredPeriods: number;
    missingPeriods: Array<{ start: string; end: string }>;
    expiresInDays: number;
  },
): EmploymentContinuityProof {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const proof: EmploymentContinuityProof = {
    id: `employment-continuity-${crypto.randomUUID()}`,
    userId,
    ...input,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  const proofs = readAll(userId);
  proofs.push(proof);
  writeAll(userId, proofs);

  return proof;
}
