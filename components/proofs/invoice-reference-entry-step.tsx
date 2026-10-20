"use client";

import { useState } from "react";
import { invoiceReferenceSchema, normalizeInvoiceReference } from "@/lib/validation/invoice-settlement-proofs";

export function InvoiceReferenceEntryStep({
  rawReference,
  onRawReferenceChange,
}: {
  rawReference: string;
  onRawReferenceChange: (value: string) => void;
}) {
  const [touched, setTouched] = useState(false);
  const validation = invoiceReferenceSchema.safeParse(rawReference);
  const normalized = normalizeInvoiceReference(rawReference);

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Invoice Reference</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Enter the private invoice reference this settlement proves. It is normalized
          locally for matching and is never sent anywhere, logged, or added to a URL.
        </p>
      </div>

      <label className="grid gap-2 text-sm text-slate-200" htmlFor="invoice-reference">
        Invoice reference
        <input
          id="invoice-reference"
          type="text"
          autoComplete="off"
          value={rawReference}
          onChange={(event) => onRawReferenceChange(event.target.value)}
          onBlur={() => setTouched(true)}
          className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
          placeholder="INV-2026-001"
        />
      </label>

      {touched && rawReference && !validation.success && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {validation.error.issues[0]?.message}
          </p>
        </div>
      )}

      {validation.success && (
        <div className="rounded-md border border-slate-600 bg-slate-900 p-3">
          <p className="text-xs text-slate-400">
            Normalized for matching: <span className="font-mono text-slate-200">{normalized}</span>
          </p>
        </div>
      )}
    </section>
  );
}
