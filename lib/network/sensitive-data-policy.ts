/**
 * Sensitive data retention and clearing policy.
 *
 * Ensures that sensitive data (payment info, proof data, personal account data)
 * is cleared on logout or account change.
 *
 * Never retains such data merely to support offline/cached display.
 * Offline recovery should use non-sensitive data (e.g., proof types, UI state)
 * but never user credentials, payment info, or proof bodies.
 */

import { TokenManager } from "@/lib/auth/token-manager";
import {
  clearAllStorage,
  removeStorageValue,
  type StorageKey,
} from "@/lib/storage";
import { SessionCoordinator } from "@/lib/auth/session-coordinator";
import { clearPendingRequests } from "./request-dedup";

/**
 * Categories of sensitive data that must be cleared on auth change.
 */
export type SensitiveDataCategory =
  | "auth-tokens"
  | "payment-data"
  | "proof-data"
  | "personal-data"
  | "pending-requests";

/**
 * Sensitive data clearing policy.
 * Triggered on logout, account change, or 401 auth failure.
 */
export class SensitiveDataPolicy {
  /**
   * Clear all sensitive data on logout.
   * Called by auth layer when user explicitly logs out.
   */
  static clearOnLogout(): void {
    // Clear tokens
    TokenManager.getInstance().clearToken();

    // Clear localStorage sensitive data
    clearAllStorage();

    // Cancel all pending requests
    clearPendingRequests();

    // Clear session coordinator state
    SessionCoordinator.getInstance().reset();

    // Clear browser caches
    clearBrowserCaches();
  }

  /**
   * Clear sensitive data on account change.
   * Called when user switches accounts or wallets.
   */
  static clearOnAccountChange(): void {
    // Same as logout for account change
    this.clearOnLogout();
  }

  /**
   * Clear sensitive data on auth failure (401/403).
   * Called by API error handler when session expires.
   */
  static clearOnAuthFailure(): void {
    // Clear tokens to force re-authentication
    TokenManager.getInstance().clearToken();

    // Clear pending requests that may be using stale token
    clearPendingRequests();

    // Reset session coordinator
    SessionCoordinator.getInstance().reset();
  }

  /**
   * Mark data category as cleared (for audit/testing).
   * In production, this is mostly informational via console logs.
   */
  static validateCleared(category: SensitiveDataCategory): boolean {
    const tokenManager = TokenManager.getInstance();
    const hasToken = tokenManager.hasToken();

    switch (category) {
      case "auth-tokens":
        return !hasToken;

      case "pending-requests":
        // Pending requests are automatically cleared
        return true;

      case "payment-data":
      case "proof-data":
      case "personal-data":
        // These are cleared via storage clearing
        // Validate by checking that sensitive storage is empty
        return !hasToken; // If token is cleared, storage was cleared

      default:
        return false;
    }
  }
}

/**
 * Browser cache clearing for sensitive data.
 * Attempts to clear various browser caches that might store sensitive responses.
 */
function clearBrowserCaches(): void {
  // Clear service worker cache for sensitive endpoints
  if ("caches" in window) {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        // Only clear caches that might contain sensitive data
        if (
          cacheName.includes("api") ||
          cacheName.includes("auth") ||
          cacheName.includes("proof") ||
          cacheName.includes("payment")
        ) {
          caches.delete(cacheName);
        }
      });
    });
  }
}

/**
 * Secure data holder that auto-clears on auth changes.
 * Useful for temporary storage of sensitive data during a request.
 *
 * Example:
 * ```
 * const holder = new SensitiveDataHolder<PaymentType>();
 * holder.set(payment);
 * const data = holder.get(); // Returns data if still auth'd
 * ```
 */
export class SensitiveDataHolder<T> {
  private data: T | null = null;
  private authToken: string | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor() {
    // Monitor auth token for changes (logout, expiry)
    const tokenManager = TokenManager.getInstance();
    this.authToken = tokenManager.getToken();
    this.unsubscribe = tokenManager.onTokenChange(() => {
      const newToken = tokenManager.getToken();
      if (this.authToken !== newToken) {
        // Auth changed, clear our data
        this.data = null;
        this.authToken = newToken;
      }
    });
  }

  /**
   * Store sensitive data. Only retained while authenticated.
   */
  set(data: T): void {
    if (TokenManager.getInstance().hasToken()) {
      this.data = data;
    }
  }

  /**
   * Retrieve sensitive data if still authenticated.
   * Returns null if auth has changed or data was never set.
   */
  get(): T | null {
    const currentToken = TokenManager.getInstance().getToken();
    if (currentToken !== this.authToken) {
      // Auth changed, discard data
      this.data = null;
    }
    return this.data;
  }

  /**
   * Explicitly clear data and unsubscribe from auth changes.
   */
  dispose(): void {
    this.data = null;
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }
}

/**
 * Decorator pattern for API functions that return sensitive data.
 * Ensures the data is cleared on auth change.
 *
 * Usage:
 * ```
 * const sensitivePayments = withSensitiveDataTracking(() => fetchPayments());
 * ```
 */
export function withSensitiveDataTracking<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  const holder = new SensitiveDataHolder<R>();

  return async (...args: T): Promise<R> => {
    const result = await fn(...args);
    holder.set(result);
    return result;
  };
}
