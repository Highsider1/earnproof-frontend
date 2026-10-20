/**
 * @jest-environment jsdom
 */

import {
  saveProofDraft,
  loadProofDraft,
  deleteProofDraft,
  clearAllProofDrafts,
  getDraftMetadata,
  type MinimumIncomeDraftData,
  type PaymentReceiptDraftData,
  type RecurringIncomeDraftData,
} from '../proof-drafts';
import { type StorageDriver } from '../index';

describe('Proof Draft Persistence', () => {
  let mockDriver: StorageDriver;
  let storage: Record<string, string>;

  beforeEach(() => {
    storage = {};
    mockDriver = {
      getItem: (key) => storage[`earnproof.${key.toLowerCase().replace('_', '-')}`] || null,
      setItem: (key, value) => {
        storage[`earnproof.${key.toLowerCase().replace('_', '-')}`] = value;
      },
      removeItem: (key) => {
        delete storage[`earnproof.${key.toLowerCase().replace('_', '-')}`];
      },
    };
  });

  describe('saveProofDraft and loadProofDraft', () => {
    it('should save and load a minimum-income draft', () => {
      const draft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['payment-1', 'payment-2'],
        thresholdAmount: '500',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      saveProofDraft('minimum-income', draft, mockDriver);
      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);

      expect(loaded).toEqual(draft);
    });

    it('should save and load a payment-receipt draft', () => {
      const draft: PaymentReceiptDraftData = {
        selectedPaymentId: 'payment-123',
        discloseSender: true,
        discloseAmount: false,
        expiresInDays: 30,
      };

      saveProofDraft('payment-receipt', draft, mockDriver);
      const loaded = loadProofDraft<PaymentReceiptDraftData>('payment-receipt', mockDriver);

      expect(loaded).toEqual(draft);
    });

    it('should save and load a recurring-income draft', () => {
      const draft: RecurringIncomeDraftData = {
        intervalUnit: 'MONTH',
        intervalCount: 1,
        periodStart: '2026-08-01',
        periodEnd: '2026-11-30',
        selectedPaymentIds: ['p1', 'p2', 'p3'],
        selectedAsset: { code: 'USDC', issuer: 'GBBD...XYZ' },
        expiresInDays: 60,
        currentStep: 'COVERAGE_ANALYSIS',
      };

      saveProofDraft('recurring-income', draft, mockDriver);
      const loaded = loadProofDraft<RecurringIncomeDraftData>('recurring-income', mockDriver);

      expect(loaded).toEqual(draft);
    });

    it('should handle null selectedAsset in recurring-income draft', () => {
      const draft: RecurringIncomeDraftData = {
        intervalUnit: 'WEEK',
        intervalCount: 2,
        periodStart: '2026-09-01',
        periodEnd: '2026-09-30',
        selectedPaymentIds: [],
        selectedAsset: null,
        expiresInDays: 30,
        currentStep: 'INTERVAL_CONFIG',
      };

      saveProofDraft('recurring-income', draft, mockDriver);
      const loaded = loadProofDraft<RecurringIncomeDraftData>('recurring-income', mockDriver);

      expect(loaded).toEqual(draft);
    });

    it('should return null for non-existent draft', () => {
      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should handle multiple draft types independently', () => {
      const minIncomeDraft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      const paymentDraft: PaymentReceiptDraftData = {
        selectedPaymentId: 'p2',
        discloseSender: false,
        discloseAmount: true,
        expiresInDays: 15,
      };

      saveProofDraft('minimum-income', minIncomeDraft, mockDriver);
      saveProofDraft('payment-receipt', paymentDraft, mockDriver);

      const loadedMinIncome = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);
      const loadedPayment = loadProofDraft<PaymentReceiptDraftData>('payment-receipt', mockDriver);

      expect(loadedMinIncome).toEqual(minIncomeDraft);
      expect(loadedPayment).toEqual(paymentDraft);
    });
  });

  describe('deleteProofDraft', () => {
    it('should delete a specific draft without affecting others', () => {
      const draft1: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      const draft2: PaymentReceiptDraftData = {
        selectedPaymentId: 'p2',
        discloseSender: true,
        discloseAmount: false,
        expiresInDays: 30,
      };

      saveProofDraft('minimum-income', draft1, mockDriver);
      saveProofDraft('payment-receipt', draft2, mockDriver);

      deleteProofDraft('minimum-income', mockDriver);

      expect(loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver)).toBeNull();
      expect(loadProofDraft<PaymentReceiptDraftData>('payment-receipt', mockDriver)).toEqual(draft2);
    });

    it('should handle deleting non-existent draft gracefully', () => {
      expect(() => deleteProofDraft('minimum-income', mockDriver)).not.toThrow();
    });

    it('should remove storage key when last draft is deleted', () => {
      const draft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      saveProofDraft('minimum-income', draft, mockDriver);
      deleteProofDraft('minimum-income', mockDriver);

      expect(storage['earnproof.proof-drafts']).toBeUndefined();
    });
  });

  describe('clearAllProofDrafts', () => {
    it('should clear all proof drafts', () => {
      const draft1: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      const draft2: PaymentReceiptDraftData = {
        selectedPaymentId: 'p2',
        discloseSender: true,
        discloseAmount: false,
        expiresInDays: 30,
      };

      saveProofDraft('minimum-income', draft1, mockDriver);
      saveProofDraft('payment-receipt', draft2, mockDriver);

      clearAllProofDrafts(mockDriver);

      expect(loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver)).toBeNull();
      expect(loadProofDraft<PaymentReceiptDraftData>('payment-receipt', mockDriver)).toBeNull();
    });
  });

  describe('draft expiration', () => {
    it('should return null for expired draft', () => {
      // Mock a draft that expired 1 day ago
      const expiredDraft = {
        version: 1,
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'minimum-income': {
            savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              selectedPaymentIds: ['p1'],
              thresholdAmount: '100',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(expiredDraft);

      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should automatically delete expired draft on load', () => {
      const expiredDraft = {
        version: 1,
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'minimum-income': {
            savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              selectedPaymentIds: ['p1'],
              thresholdAmount: '100',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(expiredDraft);

      loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);

      expect(storage['earnproof.proof-drafts']).toBeUndefined();
    });
  });

  describe('draft validation', () => {
    it('should reject corrupt minimum-income draft', () => {
      const corruptDraft = {
        version: 1,
        timestamp: new Date().toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'minimum-income': {
            savedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              selectedPaymentIds: 'not-an-array', // Invalid
              thresholdAmount: '100',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(corruptDraft);

      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should reject corrupt payment-receipt draft', () => {
      const corruptDraft = {
        version: 1,
        timestamp: new Date().toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'payment-receipt': {
            savedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              selectedPaymentId: 'p1',
              discloseSender: 'not-boolean', // Invalid
              discloseAmount: false,
              expiresInDays: 30,
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(corruptDraft);

      const loaded = loadProofDraft<PaymentReceiptDraftData>('payment-receipt', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should reject corrupt recurring-income draft', () => {
      const corruptDraft = {
        version: 1,
        timestamp: new Date().toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'recurring-income': {
            savedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              intervalUnit: 'INVALID', // Invalid
              intervalCount: 1,
              periodStart: '2026-08-01',
              periodEnd: '2026-11-30',
              selectedPaymentIds: [],
              selectedAsset: null,
              expiresInDays: 30,
              currentStep: 'INTERVAL_CONFIG',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(corruptDraft);

      const loaded = loadProofDraft<RecurringIncomeDraftData>('recurring-income', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should automatically delete corrupt draft on validation failure', () => {
      const corruptDraft = {
        version: 1,
        timestamp: new Date().toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'minimum-income': {
            savedAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              invalidField: 'corrupt data',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(corruptDraft);

      loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);

      expect(storage['earnproof.proof-drafts']).toBeUndefined();
    });
  });

  describe('getDraftMetadata', () => {
    it('should return metadata without loading full draft', () => {
      const draft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      saveProofDraft('minimum-income', draft, mockDriver);

      const metadata = getDraftMetadata('minimum-income', mockDriver);

      expect(metadata).not.toBeNull();
      expect(metadata?.isExpired).toBe(false);
      expect(metadata?.savedAt).toBeDefined();
      expect(metadata?.expiresAt).toBeDefined();
    });

    it('should indicate expired draft in metadata', () => {
      const expiredDraft = {
        version: 1,
        timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
        key: 'PROOF_DRAFTS',
        data: {
          'minimum-income': {
            savedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
            expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
            values: {
              selectedPaymentIds: ['p1'],
              thresholdAmount: '100',
              periodStart: '2026-08-01',
              periodEnd: '2026-08-31',
            },
          },
        },
      };

      storage['earnproof.proof-drafts'] = JSON.stringify(expiredDraft);

      const metadata = getDraftMetadata('minimum-income', mockDriver);

      expect(metadata).not.toBeNull();
      expect(metadata?.isExpired).toBe(true);
    });

    it('should return null for non-existent draft', () => {
      const metadata = getDraftMetadata('minimum-income', mockDriver);
      expect(metadata).toBeNull();
    });
  });

  describe('security guarantees', () => {
    it('should never persist wallet signatures', () => {
      const draft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      saveProofDraft('minimum-income', draft, mockDriver);

      const rawStorage = storage['earnproof.proof-drafts'];
      expect(rawStorage).toBeDefined();
      expect(rawStorage).not.toContain('signature');
      expect(rawStorage).not.toContain('token');
      expect(rawStorage).not.toContain('proof');
    });

    it('should only store non-secret fields', () => {
      const draft: PaymentReceiptDraftData = {
        selectedPaymentId: 'p1',
        discloseSender: true,
        discloseAmount: false,
        expiresInDays: 30,
      };

      saveProofDraft('payment-receipt', draft, mockDriver);

      const rawStorage = storage['earnproof.proof-drafts'];
      expect(rawStorage).toBeDefined();

      // Verify no sensitive data patterns
      expect(rawStorage).not.toMatch(/G[A-Z0-9]{55}/); // Stellar address pattern
      expect(rawStorage).not.toContain('credentialHash');
      expect(rawStorage).not.toContain('verificationUrl');
    });
  });

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', () => {
      storage['earnproof.proof-drafts'] = 'invalid json';

      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', mockDriver);
      expect(loaded).toBeNull();
    });

    it('should handle storage errors during save', () => {
      const failingDriver: StorageDriver = {
        getItem: () => null,
        setItem: () => {
          throw new Error('Storage quota exceeded');
        },
        removeItem: () => {},
      };

      const draft: MinimumIncomeDraftData = {
        selectedPaymentIds: ['p1'],
        thresholdAmount: '100',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      };

      expect(() => saveProofDraft('minimum-income', draft, failingDriver)).not.toThrow();
    });

    it('should handle storage errors during load', () => {
      const failingDriver: StorageDriver = {
        getItem: () => {
          throw new Error('Storage access denied');
        },
        setItem: () => {},
        removeItem: () => {},
      };

      const loaded = loadProofDraft<MinimumIncomeDraftData>('minimum-income', failingDriver);
      expect(loaded).toBeNull();
    });
  });
});
