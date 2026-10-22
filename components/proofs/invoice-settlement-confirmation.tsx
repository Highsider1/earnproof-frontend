"use client";

import { formatDate } from "@/lib/i18n";

export function InvoiceSettlementConfirmation({
  normalizedInvoiceReference,
  assetCode,
  occurredAt,
  expiresInDays,
  onExpiresInDaysChange,
  onCreateProof,
  loading,
  canSubmit,
}: {
  normalizedInvoiceReference: string;
  assetCode: string;
  occurredAt: string;
  expiresInDays: number;
  onExpiresInDaysChange: (days: number) => void;
  onCreateProof: () => void;
  loading: boolean;
  canSubmit: boolean;
}) {
  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Confirmation</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Review the fields that will be committed to the credential before issuance. The
          invoice reference itself is never included in the credential or shown to verifiers.
        </p>
      </div>

      <dl className="grid gap-2 text-sm text-slate-300">
        <div className="flex justify-between">
          <dt>Invoice reference (normalized, local only)</dt>
          <dd className="font-mono">{normalizedInvoiceReference || "-"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Asset</dt>
          <dd>{assetCode || "-"}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Settlement date</dt>
          <dd>{occurredAt ? formatDate(new Date(occurredAt)) : "-"}</dd>
        </div>
      </dl>

      <label className="grid gap-2 text-sm text-slate-200" htmlFor="settlement-expires-in-days">
        Expires in (days)
        <input
          id="settlement-expires-in-days"
          type="number"
          min={1}
          max={365}
          value={expiresInDays}
          onChange={(event) => onExpiresInDaysChange(Number(event.target.value))}
          className="h-10 w-32 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white"
        />
      </label>

      <button
        type="button"
        onClick={onCreateProof}
        disabled={loading || !canSubmit}
        className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "Creating proof..." : "Create Proof"}
      </button>
    </section>
  );
}
