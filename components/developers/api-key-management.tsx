"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CreateApiKeyForm } from "./create-api-key-form";
import { ApiKeyList } from "./api-key-list";
import { OneTimeSecret } from "./one-time-secret";
import { getApiKeysPaginated, type CreateApiKeyResponse } from "@/lib/api/keys";
import { usePagination } from "@/lib/hooks/use-pagination";
import type { ApiKey } from "@/lib/api/generated/v1";
import { readStoredSession, type Session as SessionData } from "@/lib/session";

export function ApiKeyManagement() {
  const [session] = useState<SessionData | null>(() => readStoredSession());
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestCounterRef = useRef(0);
  const sessionToken = session?.token ?? null;

  const pagination = usePagination({ pageSize: 10 });

  const loadApiKeys = useCallback(
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

        const response = await getApiKeysPaginated(
          sessionToken,
          pagination.pageSize,
          nextCursor,
          previousCursor,
          controller.signal
        );

        if (!controller.signal.aborted) {
          setApiKeys(response.items);
          pagination.setPageState(
            {
              nextCursor: response.nextCursor,
              previousCursor: response.previousCursor,
            },
            requestId
          );
        }
      } catch {
        if (!controller.signal.aborted) {
          setError("Failed to load API keys. Please try again.");
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
        void loadApiKeys();
      }
    });

    // Cleanup on unmount
    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadApiKeys]);

  const handleKeyCreated = useCallback((response: CreateApiKeyResponse) => {
    setCreatedKey(response);
    setApiKeys(prev => [...prev, response.apiKey]);
  }, []);

  const handleKeyUpdated = useCallback((updatedKey: ApiKey) => {
    setApiKeys(prev => prev.map(key => 
      key.id === updatedKey.id ? updatedKey : key
    ));
  }, []);

  const handleKeyRevoked = useCallback((keyId: string) => {
    setApiKeys(prev => prev.filter(key => key.id !== keyId));
  }, []);

  const handleSecretDismissed = useCallback(() => {
    setCreatedKey(null);
  }, []);

  const handlePreviousPage = useCallback(() => {
    pagination.goToPreviousPage();
    void loadApiKeys(false, true);
  }, [pagination, loadApiKeys]);

  const handleNextPage = useCallback(() => {
    pagination.goToNextPage();
    void loadApiKeys(true, false);
  }, [pagination, loadApiKeys]);

  // Check if user has developer role
  const isDeveloper = session?.user.role === "DEVELOPER" || session?.user.role === "ADMIN";

  if (!session) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <h2 className="text-xl font-semibold text-white">Authentication Required</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Please authenticate with a Stellar wallet to access API key management.
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

  if (!isDeveloper) {
    return (
      <div className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-5">
        <h2 className="text-xl font-semibold text-amber-100">Access Restricted</h2>
        <p className="mt-2 text-sm leading-6 text-amber-200">
          API key management requires developer role access. Contact your administrator if you need access to developer tools.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:gap-10">
      {createdKey && (
        <OneTimeSecret
          apiKey={createdKey.apiKey}
          secret={createdKey.secret}
          onDismiss={handleSecretDismissed}
        />
      )}

      <CreateApiKeyForm 
        token={session.token}
        onKeyCreated={handleKeyCreated}
      />

      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-xl font-semibold text-white">API Keys</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Manage your API keys with scoped permissions and monitor usage.
            </p>
          </div>
          <button
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
            disabled={pagination.isLoading}
            onClick={() => loadApiKeys()}
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

        <ApiKeyList
          apiKeys={apiKeys}
          loading={pagination.isLoading}
          token={session.token}
          walletAddress={session.user.walletAddress}
          paginationState={{
            ...pagination.currentPage,
            isLoading: pagination.isLoading,
          }}
          onPreviousPage={handlePreviousPage}
          onNextPage={handleNextPage}
          focusResults={pagination.wasUserInitiated}
          onKeyUpdated={handleKeyUpdated}
          onKeyRevoked={handleKeyRevoked}
        />
      </section>
    </div>
  );
}
