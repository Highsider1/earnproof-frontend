"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AuditLogFiltersForm } from "./audit-log-filters";
import { AuditLogTable } from "./audit-log-table";
import { ChainVerificationStatus } from "./chain-verification-status";
import { AuditLogExport } from "./audit-log-export";
import { getAuditLog, verifyAuditChain, validateDateRange, type AuditLogEntry, type AuditLogFilters, type ChainVerificationResult } from "@/lib/api/audit";
import { readStoredSession, type Session as SessionData } from "@/lib/session";

const FILTER_KEYS: (keyof AuditLogFilters)[] = ["actor", "action", "resource", "dateFrom", "dateTo"];

function filtersFromSearchParams(searchParams: URLSearchParams): AuditLogFilters {
  const filters: AuditLogFilters = {};
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) {
      filters[key] = value;
    }
  }
  return filters;
}

// Every organization's audit records are scoped server-side by the caller's
// own auth token - the frontend never receives, and so can never leak,
// another organization's entries. There is no client-side org filter to
// defeat here (see issue #161's "cross-organization records cannot appear
// in results or exports"); this UI only renders what getAuditLog() returns
// for the authenticated caller.
export function AuditLogManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [filters, setFiltersState] = useState<AuditLogFilters>(() => filtersFromSearchParams(searchParams));
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chainResult, setChainResult] = useState<ChainVerificationResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionToken = session?.token ?? null;

  const setFilters = useCallback(
    (next: AuditLogFilters) => {
      setFiltersState(next);
      const params = new URLSearchParams();
      for (const key of FILTER_KEYS) {
        const value = next[key];
        if (value) {
          params.set(key, value);
        }
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [router, pathname],
  );

  const loadPage = useCallback(
    async (cursor?: string) => {
      if (!sessionToken || validateDateRange(filters.dateFrom, filters.dateTo)) {
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
        const page = await getAuditLog(sessionToken, filters, controller.signal, cursor);
        if (controller.signal.aborted) {
          return;
        }
        setEntries((prev) => (cursor ? [...prev, ...page.entries] : page.entries));
        setNextCursor(page.nextCursor);
      } catch {
        if (!controller.signal.aborted) {
          setError("Failed to load the audit log. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [sessionToken, filters],
  );

  const loadChainStatus = useCallback(async () => {
    if (!sessionToken) {
      return;
    }
    try {
      const controller = new AbortController();
      const result = await verifyAuditChain(sessionToken, controller.signal);
      setChainResult(result);
    } catch {
      setChainResult({ status: "UNKNOWN", verifiedThrough: null, firstBreak: null });
    }
  }, [sessionToken]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadPage();
        void loadChainStatus();
      }
    });

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // Re-fetch (from the first page) whenever filters change, not on every
    // loadPage identity change from a Load More cursor update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionToken, filters.actor, filters.action, filters.resource, filters.dateFrom, filters.dateTo]);

  const isAdmin = session?.user.role === "ADMIN" || session?.user.role === "ISSUER";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access the audit log explorer.
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
          The audit log explorer requires administrative access. Contact your administrator if you need access
          to this tool.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      {chainResult && <ChainVerificationStatus result={chainResult} />}

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Audit Log</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Filter, inspect, and export audit records for your organization.
          </p>
        </div>

        <AuditLogFiltersForm filters={filters} onFiltersChange={setFilters} disabled={loading && entries.length === 0} />

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <AuditLogTable
          entries={entries}
          loading={loading}
          hasMore={nextCursor !== null}
          onLoadMore={() => nextCursor && loadPage(nextCursor)}
        />

        {entries.length > 0 && <AuditLogExport entries={entries} />}
      </section>
    </div>
  );
}
