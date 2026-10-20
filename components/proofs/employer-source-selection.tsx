"use client";

import { useMemo } from "react";
import {
  getSourceMatchStatus,
  truncateSourceAddress,
  type EmployerSource,
} from "@/lib/api/employer-payment-proofs";
import { formatDate, formatMessage } from "@/lib/i18n";

export function EmployerSourceSelection({
  sources,
  selectedSourceAddress,
  onSourceSelect,
  onSyncPayments,
  onRefreshPayments,
  loading,
}: {
  sources: EmployerSource[];
  selectedSourceAddress: string | null;
  onSourceSelect: (sourceAddress: string | null) => void;
  onSyncPayments: () => void;
  onRefreshPayments: () => void;
  loading: boolean;
}) {
  const matchStatus = useMemo(() => getSourceMatchStatus(sources), [sources]);
  const trustedSources = useMemo(() => sources.filter((s) => s.trust === "TRUSTED"), [sources]);
  const untrustedSources = useMemo(() => sources.filter((s) => s.trust === "UNTRUSTED"), [sources]);

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Employer Source</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Select the eligible, trusted employer source to prove payment from during this period.
            Only the count and date range of payments are shown here — no individual transaction
            details or amounts.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={loading}
            onClick={onRefreshPayments}
            type="button"
          >
            Refresh
          </button>
          <button
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
            disabled={loading}
            onClick={onSyncPayments}
            type="button"
          >
            Sync New
          </button>
        </div>
      </div>

      {matchStatus === "NO_MATCH" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-100">
            No eligible, trusted employer sources were found for this period. Sync your payments,
            widen the period, or check that your income payments have not been excluded from
            eligibility.
          </p>
        </div>
      )}

      {matchStatus === "MULTIPLE_MATCH" && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-sm text-amber-100">
            {formatMessage(
              "{count} eligible employer sources were found for this period. Select the one this proof should be based on.",
              { count: trustedSources.length }
            )}
          </p>
        </div>
      )}

      {trustedSources.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-200">Trusted sources</legend>
          <div className="mt-2 grid gap-3">
            {trustedSources.map((source) => (
              <SourceCard
                isSelectable
                isSelected={selectedSourceAddress === source.sourceAddress}
                key={source.sourceAddress}
                onSelect={() => onSourceSelect(source.sourceAddress)}
                source={source}
              />
            ))}
          </div>
        </fieldset>
      )}

      {untrustedSources.length > 0 && (
        <fieldset>
          <legend className="text-sm font-medium text-slate-200">
            Untrusted or ineligible sources
          </legend>
          <p className="mt-1 text-xs text-slate-400">
            These sources cannot be selected because at least one payment from them is excluded or
            ineligible for this period.
          </p>
          <div className="mt-2 grid gap-3">
            {untrustedSources.map((source) => (
              <SourceCard
                isSelectable={false}
                isSelected={false}
                key={source.sourceAddress}
                onSelect={() => undefined}
                source={source}
              />
            ))}
          </div>
        </fieldset>
      )}
    </section>
  );
}

function SourceCard({
  source,
  isSelected,
  isSelectable,
  onSelect,
}: {
  source: EmployerSource;
  isSelected: boolean;
  isSelectable: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`block rounded-md border p-4 transition ${
        !isSelectable
          ? "cursor-not-allowed border-white/5 bg-slate-900/50 opacity-70"
          : isSelected
          ? "cursor-pointer border-cyan-300/50 bg-cyan-300/5"
          : "cursor-pointer border-white/10 bg-slate-950 hover:border-white/20 hover:bg-slate-900"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          checked={isSelected}
          className="mt-1 h-4 w-4"
          disabled={!isSelectable}
          name="employer-source"
          onChange={onSelect}
          type="radio"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm text-white">{truncateSourceAddress(source.sourceAddress)}</p>
          <dl className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-400 sm:grid-cols-4">
            <div>
              <dt className="uppercase">Payments</dt>
              <dd className="text-slate-200">{source.paymentCount}</dd>
            </div>
            <div>
              <dt className="uppercase">Assets</dt>
              <dd className="text-slate-200">{source.assetCodes.join(", ")}</dd>
            </div>
            <div>
              <dt className="uppercase">First</dt>
              <dd className="text-slate-200">{formatDate(source.firstPaymentAt)}</dd>
            </div>
            <div>
              <dt className="uppercase">Last</dt>
              <dd className="text-slate-200">{formatDate(source.lastPaymentAt)}</dd>
            </div>
          </dl>
          {!isSelectable && (
            <p className="mt-2 text-xs text-rose-300">
              Not selectable: this source has excluded or ineligible payments in this period.
            </p>
          )}
        </div>
      </div>
    </label>
  );
}
