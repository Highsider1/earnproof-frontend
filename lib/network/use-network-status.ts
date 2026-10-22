/**
 * Hook to track network connectivity and degraded state.
 *
 * Monitors:
 * - Browser online/offline events
 * - Recent network failures
 * - Request timeout patterns
 *
 * Provides UI with:
 * - isOnline: current connectivity state (true by default, updates on event)
 * - isDegraded: detected slow/flaky network (recent failures or timeouts)
 * - lastFailureTime: timestamp of last network failure
 */

"use client";

import { useEffect, useState } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  isDegraded: boolean;
  lastFailureTime?: number;
}

const DEGRADED_TIMEOUT_MS = 30_000; // 30 seconds without successful request = degraded
const FAILURE_WINDOW_MS = 60_000; // 1 minute window to detect failure patterns

/**
 * Global network status state shared across hook instances.
 * This prevents multiple listeners on the same events.
 */
const globalNetworkStatus: NetworkStatus = {
  isOnline: typeof navigator !== "undefined" && navigator.onLine,
  isDegraded: false,
};

const listeners = new Set<(status: NetworkStatus) => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener(globalNetworkStatus));
}

/**
 * Register a network failure event, updating degraded state.
 * Called by the API client when requests fail.
 */
export function recordNetworkFailure() {
  const now = Date.now();
  globalNetworkStatus.lastFailureTime = now;
  globalNetworkStatus.isDegraded = true;

  // Schedule clearing degraded state after the timeout window
  setTimeout(() => {
    // Only clear if no new failures in the interval
    if (globalNetworkStatus.lastFailureTime === now) {
      globalNetworkStatus.isDegraded = false;
    }
  }, DEGRADED_TIMEOUT_MS);

  notifyListeners();
}

/**
 * Register a successful request, potentially clearing degraded state.
 * Called by the API client when requests succeed after failures.
 */
export function recordNetworkSuccess() {
  // Only clear degraded state if we've recovered (recent success after failures)
  if (globalNetworkStatus.isDegraded && globalNetworkStatus.lastFailureTime) {
    const timeSinceFailure = Date.now() - globalNetworkStatus.lastFailureTime;
    if (timeSinceFailure > FAILURE_WINDOW_MS) {
      globalNetworkStatus.isDegraded = false;
      globalNetworkStatus.lastFailureTime = undefined;
      notifyListeners();
    }
  }
}

/**
 * Hook to subscribe to network status changes.
 * Returns current status and updates component when status changes.
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>(globalNetworkStatus);

  useEffect(() => {
    // Update component with current global state
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus({ ...globalNetworkStatus });

    // Subscribe to future updates
    const handleStatusChange = (newStatus: NetworkStatus) => {
      setStatus({ ...newStatus });
    };

    listeners.add(handleStatusChange);

    // Listen for browser online/offline events
    const handleOnline = () => {
      globalNetworkStatus.isOnline = true;
      globalNetworkStatus.isDegraded = false;
      globalNetworkStatus.lastFailureTime = undefined;
      notifyListeners();
    };

    const handleOffline = () => {
      globalNetworkStatus.isOnline = false;
      globalNetworkStatus.isDegraded = true;
      recordNetworkFailure();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      listeners.delete(handleStatusChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return status;
}

/**
 * Expose global functions for API client integration.
 * These are called by the API layer without hook dependencies.
 */
export function setNetworkOnline(isOnline: boolean) {
  if (globalNetworkStatus.isOnline !== isOnline) {
    globalNetworkStatus.isOnline = isOnline;
    if (isOnline) {
      globalNetworkStatus.isDegraded = false;
      globalNetworkStatus.lastFailureTime = undefined;
    }
    notifyListeners();
  }
}
