"use client";

import { useEffect, useRef } from "react";
import { NetworkBadge } from "@/components/common/network-badge";
import type { UseRecentAuthResult } from "@/lib/auth/recent-auth";

export interface RecentAuthGateProps {
  recentAuth: UseRecentAuthResult;
  /** Plain-language description of the action being confirmed, e.g. "Revoke API key \"CI deploys\"". */
  actionDescription: string;
}

/**
 * Confirmation UI for useRecentAuth: shown whenever a destructive action
 * needs a fresh wallet signature. Styled after WalletConsentScreen (same
 * overlay/focus/Escape pattern), since this is the same kind of
 * security-sensitive confirmation gate, just for reauthenticating an
 * already-signed-in user rather than signing in for the first time.
 */
export function RecentAuthGate({ recentAuth, actionDescription }: RecentAuthGateProps) {
  const { isPromptOpen, status, error, challenge, confirmRecentAuth, cancelRecentAuth } =
    recentAuth;
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const isProcessing = status === "verifying";

  useEffect(() => {
    if (isPromptOpen) {
      cancelButtonRef.current?.focus();
    }
  }, [isPromptOpen]);

  useEffect(() => {
    if (!isPromptOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) {
        cancelRecentAuth();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isPromptOpen, isProcessing, cancelRecentAuth]);

  if (!isPromptOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recent-auth-title"
        aria-describedby="recent-auth-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h2 id="recent-auth-title" className="text-lg font-semibold text-white">
          Confirm with your wallet
        </h2>
        <p id="recent-auth-description" className="mt-2 text-sm leading-6 text-slate-300">
          For your security, this action needs a fresh signature: {actionDescription}
        </p>

        <dl className="mt-4 grid gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-slate-400">Network</dt>
            <dd>
              <NetworkBadge />
            </dd>
          </div>
        </dl>

        {error && (
          <p className="mt-4 rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={cancelRecentAuth}
            disabled={isProcessing}
            className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={confirmRecentAuth}
            disabled={isProcessing || !challenge}
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
