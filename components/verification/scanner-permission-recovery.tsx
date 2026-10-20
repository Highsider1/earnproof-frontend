"use client";

import { useEffect, useRef } from "react";

export interface ScannerPermissionRecoveryProps {
  /** Error message explaining why permission was denied. */
  errorMessage: string;
  /** Callback when user clicks retry button. */
  onRetry: () => void;
  /** Callback when user clicks fallback to manual entry. */
  onFallbackToManual?: () => void;
  /** Whether the retry button should be disabled. */
  retryDisabled?: boolean;
}

/**
 * Accessible permission recovery UI for QR scanner.
 *
 * Provides users with a clear, recoverable path when camera permission is denied:
 * - Explains why camera access is unavailable
 * - Provides instructions for granting permission
 * - Offers retry button
 * - Always provides manual entry fallback
 * - Full keyboard and screen reader support
 *
 * Follows WCAG 2.1 AA standards:
 * - ARIA live region for dynamic status updates
 * - Proper heading hierarchy
 * - Focus management
 * - Color contrast compliance
 * - Keyboard accessible buttons
 */
export function ScannerPermissionRecovery({
  errorMessage,
  onRetry,
  onFallbackToManual,
  retryDisabled = false,
}: ScannerPermissionRecoveryProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus the heading when component mounts for keyboard/screen reader users
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div
      className="rounded-lg border border-rose-300/50 bg-rose-300/10 p-4 sm:p-6"
      role="alert"
      aria-live="polite"
    >
      <h2
        className="text-lg font-semibold text-rose-100 focus-visible:outline-none sm:text-xl"
        ref={headingRef}
        tabIndex={-1}
      >
        Camera access is required
      </h2>

      <p className="mt-3 text-sm leading-6 text-slate-300">
        {errorMessage}
      </p>

      {/* Instructions for granting permission */}
      <div className="mt-4 rounded-lg bg-slate-950/50 p-3 sm:p-4">
        <h3 className="text-xs font-semibold text-slate-200 sm:text-sm">
          How to allow camera access:
        </h3>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-xs text-slate-400 sm:text-sm">
          <li>Look for a permission prompt or browser notification</li>
          <li>Click &quot;Allow&quot; or &quot;Grant permission&quot; in the prompt</li>
          <li>If you don&apos;t see a prompt, check your browser settings</li>
          <li>Return to this page and try again</li>
        </ol>
      </div>

      {/* Action buttons */}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg bg-cyan-300 px-6 text-sm font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          onClick={onRetry}
          disabled={retryDisabled}
          type="button"
        >
          Try again
        </button>

        {onFallbackToManual && (
          <button
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
            onClick={onFallbackToManual}
            type="button"
          >
            Enter proof ID manually
          </button>
        )}
      </div>

      {/* Accessible note about fallback */}
      <p className="mt-4 text-xs text-slate-400 sm:text-sm">
        You can always verify a proof by entering the ID or verification link manually below.
      </p>
    </div>
  );
}
