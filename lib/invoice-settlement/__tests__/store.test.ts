import {
  bindInvoiceReference,
  isReferenceBoundElsewhere,
  createInvoiceSettlementProof,
  listInvoiceSettlementProofs,
  DuplicateSettlementProofError,
} from "../store";

describe("invoice-settlement store", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe("bindInvoiceReference / isReferenceBoundElsewhere", () => {
    it("reports no conflict for a fresh reference", () => {
      expect(isReferenceBoundElsewhere("user-1", "INV-001", "pay-1")).toBe(false);
    });

    it("does not conflict with itself", () => {
      bindInvoiceReference("user-1", "INV-001", "pay-1");
      expect(isReferenceBoundElsewhere("user-1", "INV-001", "pay-1")).toBe(false);
    });

    it("reports a conflict when the reference is bound to a different payment", () => {
      bindInvoiceReference("user-1", "INV-001", "pay-1");
      expect(isReferenceBoundElsewhere("user-1", "INV-001", "pay-2")).toBe(true);
    });

    it("scopes bindings per user", () => {
      bindInvoiceReference("user-1", "INV-001", "pay-1");
      expect(isReferenceBoundElsewhere("user-2", "INV-001", "pay-2")).toBe(false);
    });

    it("does not duplicate an identical binding", () => {
      bindInvoiceReference("user-1", "INV-001", "pay-1");
      bindInvoiceReference("user-1", "INV-001", "pay-1");
      expect(isReferenceBoundElsewhere("user-1", "INV-001", "pay-2")).toBe(true);
    });
  });

  describe("createInvoiceSettlementProof", () => {
    it("creates a proof with generated id and expiry", () => {
      const proof = createInvoiceSettlementProof("user-1", {
        paymentId: "pay-1",
        normalizedInvoiceReference: "INV-001",
        expiresInDays: 30,
      });

      expect(proof.id).toMatch(/^invoice-settlement-/);
      expect(new Date(proof.expiresAt).getTime()).toBeGreaterThan(new Date(proof.createdAt).getTime());
    });

    it("persists so the proof can be listed back", () => {
      createInvoiceSettlementProof("user-1", {
        paymentId: "pay-1",
        normalizedInvoiceReference: "INV-001",
        expiresInDays: 30,
      });

      expect(listInvoiceSettlementProofs("user-1")).toHaveLength(1);
    });

    it("throws DuplicateSettlementProofError for a second proof on the same payment", () => {
      createInvoiceSettlementProof("user-1", {
        paymentId: "pay-1",
        normalizedInvoiceReference: "INV-001",
        expiresInDays: 30,
      });

      expect(() =>
        createInvoiceSettlementProof("user-1", {
          paymentId: "pay-1",
          normalizedInvoiceReference: "INV-002",
          expiresInDays: 30,
        }),
      ).toThrow(DuplicateSettlementProofError);
    });

    it("allows different payments to each have their own proof", () => {
      createInvoiceSettlementProof("user-1", {
        paymentId: "pay-1",
        normalizedInvoiceReference: "INV-001",
        expiresInDays: 30,
      });
      createInvoiceSettlementProof("user-1", {
        paymentId: "pay-2",
        normalizedInvoiceReference: "INV-002",
        expiresInDays: 30,
      });

      expect(listInvoiceSettlementProofs("user-1")).toHaveLength(2);
    });

    it("recovers gracefully from corrupted stored data", () => {
      window.localStorage.setItem("earnproof.invoice-settlement-proofs.user-1", "not-json");
      expect(listInvoiceSettlementProofs("user-1")).toEqual([]);
    });
  });
});
