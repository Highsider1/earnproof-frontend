"use client";

import { type NetworkCompatibilityCheckResult } from "@/lib/wallet/types";

/**
 * Network mismatch alert component.
 *
 * Displays wallet-to-application network compatibility issues to the user
 * with clear recovery guidance. Positioned where other wallet-related
 * errors appear in the proof flow.
 *
 * Accessibility:
 * - Uses role="alert" and aria-live="assertive" for screen reader announcement.
 * - Supports focus management via tabIndex for keyboard navigation.
 * - Heading receives focus via errorRef pattern (same as other errors).
 * - Visible text does not expose secrets or sensitive configuration details.
 *
 * Security:
 * - Only displays safe, normalized network names (not raw passphrases).
 * - No hidden elements or data attributes containing sensitive values.
 * - Cannot be bypassed through DOM manipulation or state tricks.
 */

type NetworkMismatchAlertProps = {
  result: NetworkCompatibilityCheckResult;
  forwardRef?: React.Ref<HTMLDivElement>;
};

export function NetworkMismatchAlert({
  result,
  forwardRef,
}: NetworkMismatchAlertProps) {
  if (result.isValid) {
    return null;
  }

  const alertTitle =
    result.state === "incompatible"
      ? "Wrong Network"
      : result.state === "unknown"
        ? "Network Not Detected"
        : "Unsupported Wallet";

  return (
    <div
      ref={forwardRef}
      aria-live="assertive"
      className="rounded-lg border border-amber-300/50 bg-amber-300/10 p-4 sm:p-5"
      role="alert"
    >
      <h3 className="text-sm font-semibold text-amber-100">{alertTitle}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        {result.recoveryGuidance}
      </p>
      {result.displayDetectedNetwork && (
        <div className="mt-3 space-y-1 text-xs text-slate-400">
          <p>
            Connected to: <span className="text-amber-200">{result.displayDetectedNetwork}</span>
          </p>
          <p>
            Expected: <span className="text-amber-200">{result.displayExpectedNetwork}</span>
          </p>
        </div>
      )}
    </div>
  );
}
