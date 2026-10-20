/**
 * No POST /proofs/invoice-settlement (or any invoice-settlement schema)
 * exists in the OpenAPI spec, and Payment has no invoice-reference field to
 * match against server-side (#165 has no backend support at all). This
 * store binds a normalized invoice reference to a payment client-side
 * (localStorage, scoped per user) so the wizard has something real to
 * match, preview, and create against.
 *
 * Only the normalized reference is ever stored here, never the raw
 * user-entered string, per #165's "raw invoice references are not logged,
 * persisted, or added to URLs".
 */
export type InvoiceSettlementBinding = {
  normalizedInvoiceReference: string;
  paymentId: string;
  createdAt: string;
};

export type InvoiceSettlementProof = {
  id: string;
  userId: string;
  paymentId: string;
  normalizedInvoiceReference: string;
  expiresInDays: number;
  createdAt: string;
  expiresAt: string;
};

function bindingsKey(userId: string): string {
  return `earnproof.invoice-settlement-bindings.${userId}`;
}

function proofsKey(userId: string): string {
  return `earnproof.invoice-settlement-proofs.${userId}`;
}

function readBindings(userId: string): InvoiceSettlementBinding[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(bindingsKey(userId));
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as InvoiceSettlementBinding[];
  } catch {
    window.localStorage.removeItem(bindingsKey(userId));
    return [];
  }
}

function writeBindings(userId: string, bindings: InvoiceSettlementBinding[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(bindingsKey(userId), JSON.stringify(bindings));
}

/**
 * True if `normalizedInvoiceReference` is already bound to a *different*
 * payment than `excludingPaymentId`. A reference bound twice would let one
 * invoice be claimed as settled by two different payments, so the wizard
 * blocks re-binding a reference that already points elsewhere.
 */
export function isReferenceBoundElsewhere(
  userId: string,
  normalizedInvoiceReference: string,
  excludingPaymentId: string,
): boolean {
  const bindings = readBindings(userId);
  return bindings.some(
    (binding) =>
      binding.normalizedInvoiceReference === normalizedInvoiceReference && binding.paymentId !== excludingPaymentId,
  );
}

export function bindInvoiceReference(
  userId: string,
  normalizedInvoiceReference: string,
  paymentId: string,
): InvoiceSettlementBinding {
  const bindings = readBindings(userId);

  const alreadyBound = bindings.some(
    (binding) => binding.normalizedInvoiceReference === normalizedInvoiceReference && binding.paymentId === paymentId,
  );

  if (!alreadyBound) {
    bindings.push({ normalizedInvoiceReference, paymentId, createdAt: new Date().toISOString() });
    writeBindings(userId, bindings);
  }

  return { normalizedInvoiceReference, paymentId, createdAt: new Date().toISOString() };
}

function readProofs(userId: string): InvoiceSettlementProof[] {
  if (typeof window === "undefined") {
    return [];
  }

  const stored = window.localStorage.getItem(proofsKey(userId));
  if (!stored) {
    return [];
  }

  try {
    return JSON.parse(stored) as InvoiceSettlementProof[];
  } catch {
    window.localStorage.removeItem(proofsKey(userId));
    return [];
  }
}

function writeProofs(userId: string, proofs: InvoiceSettlementProof[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(proofsKey(userId), JSON.stringify(proofs));
}

export class DuplicateSettlementProofError extends Error {
  constructor() {
    super("An invoice-settlement proof already exists for this payment.");
    this.name = "DuplicateSettlementProofError";
  }
}

export function listInvoiceSettlementProofs(userId: string): InvoiceSettlementProof[] {
  return readProofs(userId);
}

/**
 * Duplicate submission protection at the data layer, on top of the
 * submission-guard's in-flight lock: creating a second proof for a
 * paymentId that already has one throws rather than silently duplicating
 * it, so a retried/duplicated network call cannot double-issue a proof.
 */
export function createInvoiceSettlementProof(
  userId: string,
  input: { paymentId: string; normalizedInvoiceReference: string; expiresInDays: number },
): InvoiceSettlementProof {
  const proofs = readProofs(userId);

  if (proofs.some((proof) => proof.paymentId === input.paymentId)) {
    throw new DuplicateSettlementProofError();
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + input.expiresInDays * 24 * 60 * 60 * 1000);

  const proof: InvoiceSettlementProof = {
    id: `invoice-settlement-${crypto.randomUUID()}`,
    userId,
    paymentId: input.paymentId,
    normalizedInvoiceReference: input.normalizedInvoiceReference,
    expiresInDays: input.expiresInDays,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  proofs.push(proof);
  writeProofs(userId, proofs);

  return proof;
}
