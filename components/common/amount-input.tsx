"use client";

import { useId } from "react";
import { validateAssetAmountInput } from "@/lib/i18n";
import type { StellarAsset } from "@/lib/stellar/asset";
import { assetDisplayLabel } from "@/lib/stellar/asset";

export interface AmountInputProps {
  label: string;
  /** The raw decimal-string value, e.g. "12.5". Never a `number`: see lib/i18n/amount.ts. */
  value: string;
  onChange: (value: string) => void;
  asset: StellarAsset;
  id?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Shown alongside the field's own precision validation; e.g. a "required" message from the parent form. */
  externalError?: string | null;
}

/**
 * A decimal-string amount field that rejects unsupported precision as the
 * user types, rather than silently rounding it away. Always operates on the
 * raw string the user typed (or the caller controls), never a parsed
 * `number` (see lib/i18n/amount.ts for why).
 */
export function AmountInput({
  label,
  value,
  onChange,
  asset,
  id,
  placeholder = "0.00",
  disabled = false,
  externalError = null,
}: AmountInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  const precisionError = validateAssetAmountInput(value);
  const error = precisionError ?? externalError;

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-200">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2 rounded-md border border-white/10 bg-slate-900 px-4">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          className="h-11 w-full bg-transparent text-white placeholder:text-slate-400 focus:outline-none"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
        />
        <span className="shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
          {assetDisplayLabel(asset)}
        </span>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
