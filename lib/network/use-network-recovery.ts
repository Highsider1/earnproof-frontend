/**
 * Hook for integrating network recovery into component operations.
 *
 * Provides:
 * - Error classification and user-friendly messages
 * - Retry capability detection (what's safe to retry)
 * - Tracking of recovery state (pending, recovered, failed)
 */

"use client";

import { useCallback, useRef, useState } from "react";
import {
  ApiNetworkError,
  isApiNetworkError,
  shouldExposeRetry,
  getRecoveryAction,
  type RetryableRequest,
} from "@/lib/network";
import { recordNetworkFailure, recordNetworkSuccess } from "@/lib/network/use-network-status";

export type RecoveryState = "idle" | "pending" | "recovered" | "failed";

export interface NetworkRecoveryContext {
  error: ApiNetworkError | null;
  state: RecoveryState;
  canRetry: boolean;
  recoveryAction: ReturnType<typeof getRecoveryAction>;
  retry: () => Promise<void>;
  clear: () => void;
}

/**
 * Hook to manage network error recovery for an operation.
 *
 * Usage:
 * ```
 * const recovery = useNetworkRecovery(async (signal) => {
 *   return await apiCall({ signal });
 * }, { hasIdempotencyContract: true });
 *
 * if (recovery.error) {
 *   return <NetworkStatusMessage error={recovery.error} actions={[
 *     { label: recovery.recoveryAction.action, onClick: recovery.retry }
 *   ]} />;
 * }
 * ```
 */
export function useNetworkRecovery(
  operation: (signal: AbortSignal) => Promise<unknown>,
  options?: {
    method?: string;
    hasIdempotencyContract?: boolean;
    onError?: (error: ApiNetworkError) => void;
    onSuccess?: () => void;
  },
): NetworkRecoveryContext {
  const [error, setError] = useState<ApiNetworkError | null>(null);
  const [state, setState] = useState<RecoveryState>("idle");
  const abortControllerRef = useRef<AbortController | null>(null);

  const clear = useCallback(() => {
    setError(null);
    setState("idle");
  }, []);

  const canRetry =
    error !== null &&
    shouldExposeRetry(
      {
        method: options?.method || "GET",
        hasIdempotencyContract: options?.hasIdempotencyContract || false,
        execute: operation,
      },
      error,
    );

  const recoveryAction = error ? getRecoveryAction(error) : { canRetry: false, message: "" };

  const retry = useCallback(async () => {
    if (!canRetry) {
      return;
    }

    setState("pending");
    abortControllerRef.current = new AbortController();

    try {
      await operation(abortControllerRef.current.signal);
      setState("recovered");
      recordNetworkSuccess();
      options?.onSuccess?.();
      setTimeout(() => {
        setError(null);
        setState("idle");
      }, 2000); // Show success briefly
    } catch (err) {
      if (isApiNetworkError(err)) {
        setError(err);
        recordNetworkFailure();
        setState("failed");
        options?.onError?.(err);
      } else {
        throw err;
      }
    }
  }, [operation, canRetry, options]);

  const execute = useCallback(
    async (op: (signal: AbortSignal) => Promise<unknown>) => {
      setState("pending");
      abortControllerRef.current = new AbortController();

      try {
        const result = await op(abortControllerRef.current.signal);
        setState("idle");
        recordNetworkSuccess();
        options?.onSuccess?.();
        return result;
      } catch (err) {
        if (isApiNetworkError(err)) {
          setError(err);
          recordNetworkFailure();
          setState("failed");
          options?.onError?.(err);
          throw err;
        } else {
          throw err;
        }
      }
    },
    [options],
  );

  return {
    error,
    state,
    canRetry,
    recoveryAction,
    retry,
    clear,
  };
}

/**
 * Hook for debounced/throttled operations with automatic retry.
 * Useful for sync operations that shouldn't be called too frequently.
 */
export function useNetworkAwareOperation<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  options?: {
    debounceMs?: number;
    onError?: (error: ApiNetworkError) => void;
    onSuccess?: () => void;
  },
): {
  execute: () => Promise<T | null>;
  error: ApiNetworkError | null;
  isLoading: boolean;
} {
  const [error, setError] = useState<ApiNetworkError | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Cancel previous operation if debounce time hasn't elapsed
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    setIsLoading(true);
    setError(null);

    return new Promise<T | null>((resolve) => {
      debounceTimerRef.current = setTimeout(async () => {
        abortControllerRef.current = new AbortController();

        try {
          const result = await operation(abortControllerRef.current.signal);
          setIsLoading(false);
          recordNetworkSuccess();
          options?.onSuccess?.();
          resolve(result);
        } catch (err) {
          setIsLoading(false);
          if (isApiNetworkError(err)) {
            setError(err);
            recordNetworkFailure();
            options?.onError?.(err);
          }
          resolve(null);
        }
      }, options?.debounceMs || 0);
    });
  }, [operation, options]);

  return { execute, error, isLoading };
}
