/**
 * Proof wizard draft persistence utilities
 * 
 * Manages draft state for multi-step proof creation wizards, allowing users to
 * preserve validated input across page refresh and navigation.
 * 
 * Security and privacy guarantees:
 * - Only non-secret fields are persisted
 * - Wallet signatures, tokens, and final proof artifacts are never stored
 * - Drafts have an explicit retention limit (7 days default)
 * - Expired or corrupt drafts are automatically discarded
 */

import {
  getStorageValue,
  setStorageValue,
  removeStorageValue,
  type StorageDriver,
  localStorageDriver,
} from './index';

// Draft retention period: 7 days
const DRAFT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Proof types that support draft persistence
 */
export type ProofType = 'minimum-income' | 'payment-receipt' | 'recurring-income';

/**
 * Draft data for minimum income proofs
 * Excludes: wallet signatures, tokens, final proof artifacts
 */
export interface MinimumIncomeDraftData {
  selectedPaymentIds: string[];
  thresholdAmount: string;
  periodStart: string;
  periodEnd: string;
}

/**
 * Draft data for payment receipt proofs
 * Excludes: wallet signatures, tokens, final proof artifacts
 */
export interface PaymentReceiptDraftData {
  selectedPaymentId: string | null;
  discloseSender: boolean;
  discloseAmount: boolean;
  expiresInDays: number;
}

/**
 * Draft data for recurring income proofs
 * Excludes: wallet signatures, tokens, final proof artifacts
 */
export interface RecurringIncomeDraftData {
  intervalUnit: 'DAY' | 'WEEK' | 'MONTH';
  intervalCount: number;
  periodStart: string;
  periodEnd: string;
  selectedPaymentIds: string[];
  selectedAsset: { code: string; issuer: string | null } | null;
  expiresInDays: number;
  currentStep: string;
}

/**
 * Union type of all proof draft data
 */
export type ProofDraftData =
  | MinimumIncomeDraftData
  | PaymentReceiptDraftData
  | RecurringIncomeDraftData;

/**
 * Save a proof wizard draft
 */
export function saveProofDraft<T extends ProofDraftData>(
  proofType: ProofType,
  draftData: T,
  driver: StorageDriver = localStorageDriver
): void {
  try {
    const storedValue = getStorageValue('PROOF_DRAFTS', driver);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + DRAFT_RETENTION_MS);

    const data = storedValue?.data || {};
    data[proofType] = {
      savedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      values: draftData,
    };

    setStorageValue('PROOF_DRAFTS', { data }, driver);
  } catch (error) {
    console.error(`Failed to save proof draft for ${proofType}:`, error);
  }
}

/**
 * Load a proof wizard draft
 * Returns null if draft doesn't exist, is expired, or is corrupt
 */
export function loadProofDraft<T extends ProofDraftData>(
  proofType: ProofType,
  driver: StorageDriver = localStorageDriver
): T | null {
  try {
    const storedValue = getStorageValue('PROOF_DRAFTS', driver);
    if (!storedValue?.data) {
      return null;
    }

    const draft = storedValue.data[proofType];
    if (!draft) {
      return null;
    }

    // Check expiration
    const expiresAt = new Date(draft.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      // Draft expired - remove it
      deleteProofDraft(proofType, driver);
      return null;
    }

    // Validate draft structure based on proof type
    if (!validateDraftStructure(proofType, draft.values)) {
      // Corrupt draft - remove it
      deleteProofDraft(proofType, driver);
      return null;
    }

    return draft.values as T;
  } catch (error) {
    console.error(`Failed to load proof draft for ${proofType}:`, error);
    return null;
  }
}

/**
 * Delete a specific proof draft
 */
export function deleteProofDraft(
  proofType: ProofType,
  driver: StorageDriver = localStorageDriver
): void {
  try {
    const storedValue = getStorageValue('PROOF_DRAFTS', driver);
    if (!storedValue?.data) {
      return;
    }

    const data = { ...storedValue.data };
    delete data[proofType];

    if (Object.keys(data).length === 0) {
      // No drafts left - remove the entire key
      removeStorageValue('PROOF_DRAFTS', driver);
    } else {
      setStorageValue('PROOF_DRAFTS', { data }, driver);
    }
  } catch (error) {
    console.error(`Failed to delete proof draft for ${proofType}:`, error);
  }
}

/**
 * Clear all proof drafts
 */
export function clearAllProofDrafts(driver: StorageDriver = localStorageDriver): void {
  removeStorageValue('PROOF_DRAFTS', driver);
}

/**
 * Validate draft structure based on proof type
 * This ensures we don't restore corrupt or incompatible data
 */
function validateDraftStructure(proofType: ProofType, values: unknown): boolean {
  if (!values || typeof values !== 'object') {
    return false;
  }

  const data = values as Record<string, unknown>;

  switch (proofType) {
    case 'minimum-income':
      return (
        Array.isArray(data.selectedPaymentIds) &&
        typeof data.thresholdAmount === 'string' &&
        typeof data.periodStart === 'string' &&
        typeof data.periodEnd === 'string'
      );

    case 'payment-receipt':
      return (
        (typeof data.selectedPaymentId === 'string' || data.selectedPaymentId === null) &&
        typeof data.discloseSender === 'boolean' &&
        typeof data.discloseAmount === 'boolean' &&
        typeof data.expiresInDays === 'number'
      );

    case 'recurring-income':
      return (
        (data.intervalUnit === 'DAY' || data.intervalUnit === 'WEEK' || data.intervalUnit === 'MONTH') &&
        typeof data.intervalCount === 'number' &&
        typeof data.periodStart === 'string' &&
        typeof data.periodEnd === 'string' &&
        Array.isArray(data.selectedPaymentIds) &&
        (data.selectedAsset === null ||
          (typeof data.selectedAsset === 'object' &&
            data.selectedAsset !== null &&
            typeof (data.selectedAsset as Record<string, unknown>).code === 'string')) &&
        typeof data.expiresInDays === 'number' &&
        typeof data.currentStep === 'string'
      );

    default:
      return false;
  }
}

/**
 * Get draft metadata without loading the full draft
 * Useful for displaying "Resume draft?" prompts
 */
export function getDraftMetadata(
  proofType: ProofType,
  driver: StorageDriver = localStorageDriver
): { savedAt: string; expiresAt: string; isExpired: boolean } | null {
  try {
    const storedValue = getStorageValue('PROOF_DRAFTS', driver);
    if (!storedValue?.data) {
      return null;
    }

    const draft = storedValue.data[proofType];
    if (!draft) {
      return null;
    }

    const expiresAt = new Date(draft.expiresAt);
    return {
      savedAt: draft.savedAt,
      expiresAt: draft.expiresAt,
      isExpired: expiresAt.getTime() <= Date.now(),
    };
  } catch {
    return null;
  }
}
