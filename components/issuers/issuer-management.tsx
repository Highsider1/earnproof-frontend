"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreateIssuerForm } from "./create-issuer-form";
import { IssuerList } from "./issuer-list";
import { getIssuersPaginated } from "@/lib/api/issuers";
import { getOrganizations } from "@/lib/api/organizations";
import { usePagination } from "@/lib/hooks/use-pagination";
import type { IssuerWithRevision } from "@/lib/api/issuers";
import type { OrganizationWithRevision } from "@/lib/api/organizations";
import { readStoredSession, type Session as SessionData } from "@/lib/session";

export function IssuerManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const [issuers, setIssuers] = useState<IssuerWithRevision[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationWithRevision[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef(0);
  const sessionToken = session?.token ?? null;

  const pagination = usePagination({ pageSize: 10 });

  const loadData = useCallback(
    async (navigateToNext: boolean = false, navigateToPrev: boolean = false) => {
      if (!sessionToken) {
        return;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;
      requestCounterRef.current += 1;
      const requestId = `req-${requestCounterRef.current}`;

      pagination.setLoading(true);
      setError(null);

      try {
        let nextCursor = pagination.currentPage.nextCursor ?? undefined;
        let previousCursor = pagination.currentPage.previousCursor ?? undefined;

        // Handle navigation requests
        if (navigateToNext && pagination.currentPage.nextCursor) {
          previousCursor = pagination.currentPage.nextCursor;
          nextCursor = undefined;
        } else if (navigateToPrev && pagination.currentPage.previousCursor) {
          nextCursor = pagination.currentPage.previousCursor;
          previousCursor = undefined;
        }

        const [issuersResponse, orgsData] = await Promise.all([
          getIssuersPaginated(
            sessionToken,
            pagination.pageSize,
            nextCursor,
            previousCursor,
            controller.signal
          ),
          getOrganizations(sessionToken, controller.signal),
        ]);

        if (!controller.signal.aborted) {
          setIssuers(issuersResponse.items);
          setOrganizations(orgsData);
          pagination.setPageState(
            {
              nextCursor: issuersResponse.nextCursor,
              previousCursor: issuersResponse.previousCursor,
            },
            requestId
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Failed to load issuers and organizations. Please try again.");
        }
      } finally {
        if (!controller.signal.aborted) {
          pagination.setLoading(false);
          pagination.clearUserInitiated();
        }
      }
    },
    [sessionToken, pagination]
  );

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadData();
      }
    });

    // Cleanup on unmount
    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadData]);

  const handleIssuerCreated = useCallback((issuer: IssuerWithRevision) => {
    setIssuers(prev => [...prev, issuer]);
  }, []);

  const handleIssuerUpdated = useCallback((updatedIssuer: IssuerWithRevision) => {
    setIssuers(prev => prev.map(issuer => 
      issuer.id === updatedIssuer.id ? updatedIssuer : issuer
    ));
  }, []);

  const handlePreviousPage = useCallback(() => {
    pagination.goToPreviousPage();
    void loadData(false, true);
  }, [pagination, loadData]);

  const handleNextPage = useCallback(() => {
    pagination.goToNextPage();
    void loadData(true, false);
  }, [pagination, loadData]);

  // Check if user has admin role
  const isAdmin = session?.user.role === "ADMIN" || session?.user.role === "ISSUER";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access issuer management.
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
          Issuer management requires administrative access. Contact your administrator if you need access to issuer management tools.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      <CreateIssuerForm 
        token={session.token}
        organizations={organizations}
        onIssuerCreated={handleIssuerCreated}
      />

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">Issuers</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage issuers, their organizational relationships, and administrative status.
            </p>
          </div>
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={pagination.isLoading}
            onClick={() => loadData()}
            type="button"
          >
            {pagination.isLoading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <IssuerList
          issuers={issuers}
          organizations={organizations}
          loading={pagination.isLoading}
          token={session.token}
          walletAddress={session.user.walletAddress}
          role={session.user.role}
          paginationState={{
            ...pagination.currentPage,
            isLoading: pagination.isLoading,
          }}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          focusResults={pagination.wasUserInitiated}
          onIssuerUpdated={handleIssuerUpdated}
        />
      </section>
    </div>
  );
}
