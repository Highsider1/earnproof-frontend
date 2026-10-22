"use client";

import Link from "next/link";
import { findSuccessorOf, findPredecessorOf } from "@/lib/proof-renewal/store";

/**
 * Displays a proof's predecessor/successor links (#168's "Display
 * predecessor and successor links on proof details"). Renders nothing when
 * a proof has neither, rather than an empty section.
 */
export function ProofLineage({ userId, proofId }: { userId: string; proofId: string }) {
  const predecessorLink = findPredecessorOf(userId, proofId);
  const successorLink = findSuccessorOf(userId, proofId);

  if (!predecessorLink && !successorLink) {
    return null;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
      <h3 className="text-sm font-semibold text-white">Proof Lineage</h3>
      <dl className="mt-2 grid gap-2 text-sm">
        {predecessorLink && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-400">Renewed from</dt>
            <dd>
              <Link
                href={`/proofs/verify?proof=${predecessorLink.predecessorId}`}
                className="font-mono text-xs text-cyan-300 hover:text-cyan-200"
              >
                {predecessorLink.predecessorId}
              </Link>
            </dd>
          </div>
        )}
        {successorLink && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-slate-400">Renewed into</dt>
            <dd>
              <Link
                href={`/proofs/verify?proof=${successorLink.successorId}`}
                className="font-mono text-xs text-cyan-300 hover:text-cyan-200"
              >
                {successorLink.successorId}
              </Link>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
