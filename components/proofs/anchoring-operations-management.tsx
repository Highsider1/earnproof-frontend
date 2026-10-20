"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnchoringOperationList } from "./anchoring-operation-list";
import { getAnchoringOperations, type AnchoringOperation } from "@/lib/api/anchoring";
import { readStoredSession, type Session as SessionData } from "@/lib/session";

// Anchoring recovery is a privileged operations tool - retrying/reconciling
// an anchoring attempt touches proof state other users depend on, so it's
// gated the same way as the other admin/developer-only management screens
// (organization-management.tsx, api-key-management.tsx), not exposed to
// every authenticated worker. See issue #167's "only authorized users can
// invoke recovery actions."
export function AnchoringOperationsManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const [operations, setOperations] = useState<AnchoringOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionToken = session?.token ?? null;

  const loadOperations = useCallback(async () => {
    if (!sessionToken) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const ops = await getAnchoringOperations(sessionToken, controller.signal);
      if (!controller.signal.aborted) {
        setOperations(ops);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Failed to load anchoring operations. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [sessionToken]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadOperations();
      }
    });

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadOperations]);

  const handleOperationUpdated = useCallback((updated: AnchoringOperation) => {
    setOperations((prev) => prev.map((operation) => (operation.id === updated.id ? updated : operation)));
  }, []);

  const isAdmin = session?.user.role === "ADMIN" || session?.user.role === "ISSUER";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access anchoring recovery.
        </p>
        <a
          className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200"
          href="/proofs"
        >
          Connect Wallet
        </a>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
        <h2 className="text-xl font-semibold text-amber-100">Access Restricted</h2>
        <p className="mt-2 text-sm leading-6 text-amber-200">
          Anchoring recovery requires administrative access. Contact your administrator if you need access to
          this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Anchoring Operations</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Review failed or quarantined proof anchoring operations and retry or reconcile them.
            </p>
          </div>
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={loading}
            onClick={loadOperations}
            type="button"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <AnchoringOperationList
          operations={operations}
          loading={loading}
          token={session.token}
          onOperationUpdated={handleOperationUpdated}
        />
      </section>
    </div>
  );
}
