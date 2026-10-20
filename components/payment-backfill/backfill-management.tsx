"use client";

import { useCallback, useEffect, useState } from "react";
import { CreateBackfillForm } from "./create-backfill-form";
import { BackfillJobList } from "./backfill-job-list";
import { listBackfillJobs, type BackfillJobRecord } from "@/lib/payment-backfill/store";
import { readStoredSession, type Session } from "@/lib/session";

export function BackfillManagement() {
  const [session] = useState<Session | null>(() => readStoredSession());
  const [jobs, setJobs] = useState<BackfillJobRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Administrators only, per #171's own framing ("Administrators need a
  // safe interface...").
  const isAuthorized = session?.user.role === "ADMIN";

  const loadData = useCallback(() => {
    if (!isAuthorized || !session) return;
    setLoading(true);
    try {
      setJobs(listBackfillJobs(session.user.id));
    } finally {
      setLoading(false);
    }
  }, [isAuthorized, session]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        loadData();
      }
    });

    return () => {
      active = false;
    };
  }, [loadData]);

  const handleJobCreated = useCallback((job: BackfillJobRecord) => {
    setJobs((prev) => [job, ...prev]);
  }, []);

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access payment backfill controls.
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

  if (!isAuthorized) {
    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
        <h2 className="text-xl font-semibold text-amber-100">Access Restricted</h2>
        <p className="mt-2 text-sm leading-6 text-amber-200">
          Payment backfill controls require administrative access. Contact your
          administrator if you need access to this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      <CreateBackfillForm userId={session.user.id} onJobCreated={handleJobCreated} />

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Backfill Jobs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Track queued, running, and completed payment backfill requests.
            </p>
          </div>
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={loading}
            onClick={loadData}
            type="button"
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        <BackfillJobList
          userId={session.user.id}
          token={session.token}
          jobs={jobs}
          onJobsChanged={setJobs}
        />
      </section>
    </div>
  );
}
