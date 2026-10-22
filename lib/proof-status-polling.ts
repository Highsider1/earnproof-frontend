"use client";

import { useEffect, useState } from "react";
import {
  verifyProof,
  isTerminalProofStatus,
  type VerifyProofResponse,
} from "@/lib/api/verify-proof";

export type ProofStatusPollingState = {
  data: VerifyProofResponse | null;
  loading: boolean;
  error: string | null;
  isTerminal: boolean;
};

const BASE_DELAY_MS = 5_000;
const MAX_DELAY_MS = 60_000;

/**
 * Visibility-aware, bounded-backoff polling for a proof's mutable
 * verification status (#154).
 *
 * - Refreshes only while the tab is visible: a hidden tab pauses polling
 *   entirely and a foreground/visibility event resumes it immediately
 *   rather than waiting out whatever delay was already in flight.
 * - Stops permanently once the proof reaches a terminal status
 *   (expired/revoked/invalid — see isTerminalProofStatus) or the component
 *   unmounts/proofId changes.
 * - A transient failure (network error, non-2xx) backs off exponentially
 *   (capped at MAX_DELAY_MS) and keeps the last confirmed `data`, rather
 *   than clearing it — a proof that was valid a moment ago should not
 *   flash to an error/empty state because one poll failed.
 * - Exactly one polling loop exists per (proofId, token) pair: the effect's
 *   cleanup aborts the in-flight request and clears the scheduled timer
 *   before a new loop starts, so remounts/dependency changes never stack
 *   loops on top of each other. All loop state (timer, in-flight
 *   controller, backoff attempt, stopped flag) lives in refs owned by that
 *   single effect run, not in the poll function's closure, so there is no
 *   risk of a stale poll() reference scheduling a duplicate loop.
 * - A stale response can never overwrite a newer one: each poll captures
 *   its own AbortController and only applies its result if that same
 *   controller is still the active one when it resolves.
 */
const INITIAL_STATE: ProofStatusPollingState = {
  data: null,
  loading: true,
  error: null,
  isTerminal: false,
};

export function useProofStatusPolling(
  proofId: string,
  token?: string | null,
): ProofStatusPollingState {
  const [state, setState] = useState<ProofStatusPollingState>(INITIAL_STATE);

  // Reset synchronously during render when (proofId, token) changes, rather
  // than via setState inside the effect below. This is React's documented
  // "adjusting state when a prop changes" pattern (state, not a ref, tracks
  // the previous key, since refs cannot be read or written during render)
  // and avoids the extra render pass react-hooks/set-state-in-effect flags.
  const key = `${proofId}:${token ?? ""}`;
  const [prevKey, setPrevKey] = useState(key);
  if (prevKey !== key) {
    setPrevKey(key);
    setState(INITIAL_STATE);
  }

  useEffect(() => {
    let stopped = false;
    let attempt = 0;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const scheduleNext = (delayMs: number) => {
      clearTimer();
      if (stopped) return;
      timer = setTimeout(() => {
        void poll();
      }, delayMs);
    };

    async function poll() {
      if (stopped) return;
      if (typeof document !== "undefined" && document.hidden) {
        // Don't fetch while hidden; visibilitychange below re-triggers a
        // poll immediately once the tab becomes visible again.
        return;
      }

      controller?.abort();
      const thisController = new AbortController();
      controller = thisController;
      const isCurrent = () => controller === thisController;

      setState((prev) => ({ ...prev, loading: true }));

      try {
        const result = await verifyProof(proofId, thisController.signal, token);
        if (!isCurrent() || stopped) return;

        attempt = 0;
        const terminal = isTerminalProofStatus(result.status);
        setState({ data: result, loading: false, error: null, isTerminal: terminal });

        if (terminal) {
          stopped = true;
          return;
        }

        scheduleNext(BASE_DELAY_MS);
      } catch (err) {
        if (!isCurrent() || stopped) return;
        if (err instanceof DOMException && err.name === "AbortError") return;

        const message =
          err instanceof Error ? err.message : "Failed to refresh proof status";
        // Preserve the last confirmed `data` — only loading/error change.
        setState((prev) => ({ ...prev, loading: false, error: message }));

        attempt += 1;
        const backoff = Math.min(BASE_DELAY_MS * 2 ** attempt, MAX_DELAY_MS);
        scheduleNext(backoff);
      }
    }

    void poll();

    const handleVisibilityChange = () => {
      if (!document.hidden && !stopped) {
        clearTimer();
        void poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopped = true;
      clearTimer();
      controller?.abort();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [proofId, token]);

  return state;
}
