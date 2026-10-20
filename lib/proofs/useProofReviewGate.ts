"use client";

import { useCallback, useState } from "react";

/**
 * Gates a proof submission behind an explicit review-and-confirm step,
 * built around one frozen snapshot of the exact payload that will be sent.
 *
 * Why a frozen snapshot rather than re-deriving the payload at submit time:
 * this issue requires "the reviewed payload is byte-equivalent to the
 * submitted payload" and "changes after review invalidate confirmation."
 * Re-deriving the payload from live state at submit time can never
 * guarantee byte-equivalence with whatever was rendered a moment earlier —
 * the only way to guarantee it is to build the payload once, freeze it, and
 * submit that exact object. Confirmation is invalidated the instant the
 * live payload no longer matches (by value) the frozen one, which callers
 * detect by calling `refreshLiveSnapshot` whenever a dependency of the
 * builder changes (e.g. in a useEffect) — this hook does not itself know
 * which state a given flow's builder reads, so it cannot poll on its own.
 */
export function useProofReviewGate<TPayload>() {
  const [reviewedPayload, setReviewedPayload] = useState<TPayload | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const openReview = useCallback((payload: TPayload) => {
    setReviewedPayload(payload);
    setIsConfirmed(false);
  }, []);

  const confirm = useCallback(() => {
    setIsConfirmed(true);
  }, []);

  const cancel = useCallback(() => {
    setReviewedPayload(null);
    setIsConfirmed(false);
  }, []);

  /** Call whenever a live input the payload is built from changes. If the
   * newly-built payload differs from the frozen one, confirmation is
   * revoked and the review must happen again before submitting. */
  const refreshLiveSnapshot = useCallback((currentPayload: TPayload) => {
    setReviewedPayload((frozen) => {
      if (frozen === null) return frozen;
      if (JSON.stringify(frozen) !== JSON.stringify(currentPayload)) {
        setIsConfirmed(false);
      }
      return frozen;
    });
  }, []);

  const reset = useCallback(() => {
    setReviewedPayload(null);
    setIsConfirmed(false);
  }, []);

  return {
    /** The exact, frozen payload under review (or being submitted). Null
     * until openReview() is called. */
    reviewedPayload,
    /** True only when the user has explicitly confirmed, AND no input has
     * changed since. Submission must be gated on this, not on
     * reviewedPayload alone. */
    isConfirmed,
    openReview,
    confirm,
    cancel,
    refreshLiveSnapshot,
    /** Call after a successful (or abandoned) submission to clear state for
     * the next attempt. */
    reset,
  };
}
