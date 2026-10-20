"use client";

import { useCallback, useState } from "react";
import {
  checkRenewalEligibility,
  isCompatibleRenewalType,
} from "@/lib/validation/proof-renewal";
import {
  recordRenewal,
  findSuccessorOf,
  DuplicateSuccessorError,
  RenewalCycleError,
} from "@/lib/proof-renewal/store";
import type { ProofListItem } from "@/lib/api/proofs-list";

export type RenewalPolicyFields = {
  assetCode: string;
  assetIssuer?: string | null;
};

/**
 * Fields safe to pre-fill onto a renewal from its predecessor: asset
 * identity only. Deliberately excludes anything transient/sensitive —
 * exact claimed amounts, source/destination addresses, memo text, or the
 * original signed credential material — per #168's "Pre-fill allowed
 * policy fields without copying sensitive transient data" scope.
 */
export function extractRenewalPolicyFields(predecessor: ProofListItem): RenewalPolicyFields {
  return {
    assetCode: predecessor.summary.assetCode,
    assetIssuer: predecessor.summary.assetIssuer ?? null,
  };
}

/**
 * Renewal action for a single proof (#168). Gated by checkRenewalEligibility
 * (revoked/wrong-owner proofs never even show a Renew control) and by
 * whether a successor already exists (a proof can only be renewed once —
 * the earlier successor is the current one to work from instead).
 *
 * `onCreateSuccessor` is caller-supplied rather than hard-coded to one
 * proof-creation endpoint: renewal must create the *same type* of proof as
 * the predecessor (isCompatibleRenewalType), and each proof type has its
 * own creation request shape and endpoint. This component owns eligibility
 * and linkage; the type-specific creation call stays with whichever flow
 * already knows how to build that type's request.
 */
export function ProofRenewalAction({
  userId,
  predecessor,
  callerIssuerId,
  onCreateSuccessor,
  onRenewed,
}: {
  userId: string;
  predecessor: ProofListItem;
  callerIssuerId: string;
  onCreateSuccessor: (policy: RenewalPolicyFields) => Promise<{ id: string; type: ProofListItem["type"] }>;
  onRenewed: (successorId: string) => void;
}) {
  const [isRenewing, setIsRenewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSuccessor = findSuccessorOf(userId, predecessor.id);
  const eligibility = checkRenewalEligibility(predecessor, callerIssuerId);

  const handleRenew = useCallback(async () => {
    setError(null);
    setIsRenewing(true);
    try {
      const policy = extractRenewalPolicyFields(predecessor);
      const successor = await onCreateSuccessor(policy);

      if (!isCompatibleRenewalType(predecessor.type, successor.type)) {
        setError(
          "Renewal must produce the same proof type as the original. The new proof was not linked.",
        );
        return;
      }

      recordRenewal(userId, predecessor.id, successor.id);
      onRenewed(successor.id);
    } catch (err) {
      if (err instanceof DuplicateSuccessorError) {
        setError("This proof has already been renewed.");
      } else if (err instanceof RenewalCycleError) {
        setError("This renewal would create an invalid predecessor/successor cycle.");
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to renew this proof. Please try again.",
        );
      }
    } finally {
      setIsRenewing(false);
    }
  }, [predecessor, userId, onCreateSuccessor, onRenewed]);

  if (existingSuccessor) {
    return (
      <p className="text-xs text-slate-400">
        Already renewed. See the successor proof for the current version.
      </p>
    );
  }

  if (!eligibility.eligible) {
    return (
      <p className="text-xs text-slate-500" title={eligibility.reason}>
        Renewal unavailable
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <button
        onClick={() => void handleRenew()}
        disabled={isRenewing}
        className="h-9 rounded-md border border-cyan-300/30 px-4 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/10 disabled:cursor-not-allowed disabled:opacity-50"
        type="button"
      >
        {isRenewing ? "Renewing..." : "Renew this proof"}
      </button>
      {error && (
        <p className="text-xs text-rose-300" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
