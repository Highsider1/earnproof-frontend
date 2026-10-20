"use client";

import { useEffect, useRef } from "react";
import { NetworkBadge } from "@/components/common/network-badge";
import { formatDateTime } from "@/lib/i18n";

export interface WalletChallengeDetails {
  origin: string;
  network: string;
  expiresAt: string;
  purpose: string;
}

interface WalletConsentScreenProps {
  challenge: WalletChallengeDetails;
  onContinue: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

/**
 * Shown after a signature challenge is issued and before it is signed, so
 * the user can review what they are about to authorize. Styled after
 * ConfirmationDialog (same overlay/focus/Escape pattern) since this is
 * functionally a confirmation gate for a security-sensitive action.
 */
export function WalletConsentScreen({
  challenge,
  onContinue,
  onCancel,
  isProcessing = false,
}: WalletConsentScreenProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel, isProcessing]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="wallet-consent-title"
        aria-describedby="wallet-consent-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h2 id="wallet-consent-title" className="text-lg font-semibold text-white">
          Review signature request
        </h2>
        <p id="wallet-consent-description" className="mt-2 text-sm leading-6 text-slate-300">
          {challenge.purpose}
        </p>

        <dl className="mt-4 grid gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Origin</dt>
            <dd className="font-mono text-xs text-white">{challenge.origin}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Network</dt>
            <dd>
              <NetworkBadge />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Expires</dt>
            <dd className="text-xs text-white">{formatDateTime(challenge.expiresAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isProcessing}
            className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onContinue}
            disabled={isProcessing}
            className="h-10 rounded-md bg-cyan-300 px-4 text-sm font-medium text-slate-950 hover:bg-cyan-200 disabled:opacity-50 transition"
            type="button"
          >
            {isProcessing ? "Signing..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
