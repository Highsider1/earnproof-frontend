"use client";

import { useState } from "react";
import type { ProofHistoryFilters } from "@/lib/hooks/use-proof-history-state";
import type { ProofStatus, ProofType } from "@/lib/api/proofs-list";
import { formatProofStatus, formatProofType } from "@/lib/api/proofs-list";

export type ProofHistoryFiltersProps = {
  filters: ProofHistoryFilters;
  onFiltersChange: (filters: ProofHistoryFilters) => void;
  disabled?: boolean;
};

const PROOF_STATUSES: ProofStatus[] = ["PENDING", "VALID", "EXPIRED", "REVOKED"];
const PROOF_TYPES: ProofType[] = ["MINIMUM_INCOME", "PAYMENT_RECEIPT", "RECURRING_INCOME"];

/**
 * Filter controls for proof history list.
 * Allows filtering by status, type, issuer, and date range.
 * All changes are immediately reflected in the URL and trigger a fresh API request.
 */
export function ProofHistoryFilters({
  filters,
  onFiltersChange,
  disabled = false,
}: ProofHistoryFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [issuerInput, setIssuerInput] = useState(filters.issuerId || "");
  const [dateFromInput, setDateFromInput] = useState(filters.createdFrom || "");
  const [dateUntilInput, setDateUntilInput] = useState(filters.createdUntil || "");

  // Count active filters for badge
  const activeFilterCount = Object.values(filters).filter(Boolean).length;

  const handleStatusChange = (status: ProofStatus | undefined) => {
    onFiltersChange({
      ...filters,
      status: status === filters.status ? undefined : status,
    });
  };

  const handleTypeChange = (type: ProofType | undefined) => {
    onFiltersChange({
      ...filters,
      type: type === filters.type ? undefined : type,
    });
  };

  const handleIssuerChange = () => {
    onFiltersChange({
      ...filters,
      issuerId: issuerInput.trim() || undefined,
    });
  };

  const handleDateFromChange = () => {
    onFiltersChange({
      ...filters,
      createdFrom: dateFromInput || undefined,
    });
  };

  const handleDateUntilChange = () => {
    onFiltersChange({
      ...filters,
      createdUntil: dateUntilInput || undefined,
    });
  };

  const handleClearFilters = () => {
    onFiltersChange({});
    setIssuerInput("");
    setDateFromInput("");
    setDateUntilInput("");
  };

  return (
    <div className="space-y-3 rounded-lg border border-white/10 bg-white/[0.04] p-4 sm:p-5">
      {/* Header with toggle and badge */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          disabled={disabled}
          className="flex items-center gap-2 text-sm font-medium text-white hover:text-cyan-200 disabled:opacity-50"
        >
          <svg
            className={`h-5 w-5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
          Filters
          {activeFilterCount > 0 && (
            <span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-cyan-400/20 text-xs font-semibold text-cyan-300">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleClearFilters}
            disabled={disabled}
            className="text-xs font-medium text-slate-300 hover:text-white disabled:opacity-50"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Filter controls (collapsed/expanded) */}
      {isExpanded && (
        <div className="grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Status filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Status
            </label>
            <div className="space-y-1.5">
              {PROOF_STATUSES.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  disabled={disabled}
                  className={`block w-full rounded-lg border px-3 py-2 text-sm font-medium text-left transition ${
                    filters.status === status
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                  } disabled:opacity-50`}
                >
                  {formatProofStatus(status)}
                </button>
              ))}
            </div>
          </div>

          {/* Type filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Type
            </label>
            <div className="space-y-1.5">
              {PROOF_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeChange(type)}
                  disabled={disabled}
                  className={`block w-full rounded-lg border px-3 py-2 text-sm font-medium text-left transition ${
                    filters.type === type
                      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                      : "border-white/10 bg-white/[0.04] text-slate-300 hover:border-white/20 hover:bg-white/[0.06]"
                  } disabled:opacity-50`}
                >
                  {formatProofType(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Issuer filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Issuer ID
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={issuerInput}
                onChange={(e) => setIssuerInput(e.target.value)}
                onBlur={handleIssuerChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleIssuerChange();
                  }
                }}
                disabled={disabled}
                placeholder="Filter by issuer..."
                className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 disabled:opacity-50"
              />
            </div>
          </div>

          {/* Date range filter */}
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Created Date
            </label>
            <div className="space-y-1.5">
              <input
                type="date"
                value={dateFromInput}
                onChange={(e) => setDateFromInput(e.target.value)}
                onBlur={handleDateFromChange}
                disabled={disabled}
                placeholder="From"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 disabled:opacity-50"
              />
              <input
                type="date"
                value={dateUntilInput}
                onChange={(e) => setDateUntilInput(e.target.value)}
                onBlur={handleDateUntilChange}
                disabled={disabled}
                placeholder="Until"
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white focus:border-cyan-400/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Active filter pills (always visible when filters are applied) */}
      {activeFilterCount > 0 && !isExpanded && (
        <div className="flex flex-wrap gap-2">
          {filters.status && (
            <FilterPill
              label={formatProofStatus(filters.status)}
              onRemove={() => handleStatusChange(null)}
              disabled={disabled}
            />
          )}
          {filters.type && (
            <FilterPill
              label={formatProofType(filters.type)}
              onRemove={() => handleTypeChange(null)}
              disabled={disabled}
            />
          )}
          {filters.issuerId && (
            <FilterPill
              label={`Issuer: ${filters.issuerId}`}
              onRemove={() => onFiltersChange({ ...filters, issuerId: undefined })}
              disabled={disabled}
            />
          )}
          {filters.createdFrom && (
            <FilterPill
              label={`From: ${filters.createdFrom}`}
              onRemove={() => onFiltersChange({ ...filters, createdFrom: undefined })}
              disabled={disabled}
            />
          )}
          {filters.createdUntil && (
            <FilterPill
              label={`Until: ${filters.createdUntil}`}
              onRemove={() => onFiltersChange({ ...filters, createdUntil: undefined })}
              disabled={disabled}
            />
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Individual filter pill that can be removed
 */
function FilterPill({
  label,
  onRemove,
  disabled,
}: {
  label: string;
  onRemove: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-3 py-1.5 text-sm text-cyan-200">
      <span>{label}</span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="ml-1 text-cyan-200 hover:text-cyan-100 focus:outline-none disabled:opacity-50"
        aria-label={`Remove ${label} filter`}
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
