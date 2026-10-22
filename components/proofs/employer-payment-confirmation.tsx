"use client";

import { truncateSourceAddress, type EmployerSource } from "@/lib/api/employer-payment-proofs";
import { formatDate, formatDateRange, formatMessage } from "@/lib/i18n";

export function EmployerPaymentConfirmation({
  source,
  periodStart,
  periodEnd,
  assetCode,
  assetCodeOptions,
  onAssetCodeChange,
  expiresInDays,
  onExpiresInDaysChange,
  onCreateProof,
  loading,
}: {
  source: EmployerSource | null;
  periodStart: string;
  periodEnd: string;
  assetCode: string | null;
  assetCodeOptions: string[];
  onAssetCodeChange: (assetCode: string) => void;
  expiresInDays: number;
  onExpiresInDaysChange: (days: number) => void;
  onCreateProof: () => void;
  loading: boolean;
}) {
  const canCreateProof = Boolean(source) && Boolean(assetCode);

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Review &amp; Create</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          This proof will confirm that eligible payments were received from the selected source
          during the period below. It will not disclose individual transaction hashes, dates, or
          amounts — only that the pattern qualifies.
        </p>
      </div>

      {source ? (
        <div className="rounded-lg border border-cyan-300/50 bg-cyan-300/5 p-4">
          <h3 className="text-lg font-semibold text-white">Proof Preview</h3>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-400">Employer Source:</dt>
              <dd className="font-mono text-slate-200">{truncateSourceAddress(source.sourceAddress)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Period:</dt>
              <dd className="text-slate-200">{formatDateRange(periodStart, periodEnd)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Qualifying Payments:</dt>
              <dd className="text-slate-200">{source.paymentCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Exact Amount:</dt>
              <dd className="text-emerald-300">Never disclosed</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-400">
            {formatMessage("Most recent qualifying payment: {date}", {
              date: formatDate(source.lastPaymentAt),
            })}
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-white/10 bg-slate-950 p-4">
          <p className="text-sm text-slate-400">Select an employer source to see a preview.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="employer-asset-code">
            Asset
          </label>
          <select
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white disabled:opacity-50"
            disabled={assetCodeOptions.length === 0}
            id="employer-asset-code"
            onChange={(e) => onAssetCodeChange(e.target.value)}
            value={assetCode ?? ""}
          >
            {assetCodeOptions.length === 0 && <option value="">No assets available</option>}
            {assetCodeOptions.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200" htmlFor="employer-expires-days">
            Expires In (Days)
          </label>
          <input
            className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white"
            id="employer-expires-days"
            max={365}
            min={1}
            onChange={(e) => onExpiresInDaysChange(parseInt(e.target.value, 10) || 90)}
            type="number"
            value={expiresInDays}
          />
        </div>
      </div>

      <button
        className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
        disabled={!canCreateProof || loading}
        onClick={onCreateProof}
        type="button"
      >
        {loading ? "Creating..." : "Create Employer Payment Proof"}
      </button>
    </section>
  );
}
