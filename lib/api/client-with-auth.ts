/**
 * Enhanced API client with SessionCoordinator integration for 401 handling.
 *
 * This client wraps the base apiClient and adds:
 * - Automatic token injection from TokenManager
 * - 401 interception with SessionCoordinator (concurrent deduplication)
 * - Automatic retry on successful token recovery
 * - No token material in logs/errors
 */

import { apiClient } from './client';
import { SessionCoordinator } from '@/lib/auth/session-coordinator';
import { TokenManager } from '@/lib/auth/token-manager';
import { bearer } from './client';

type ApiClientOptions = RequestInit & {
  path: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

export interface AuthenticatedApiClientOptions extends ApiClientOptions {
  /**
   * If true, this request will be retried after token recovery.
   * Default: true for GET/HEAD, false for mutations.
   */
  shouldRetryAfterRecovery?: boolean;

  /**
   * Called when 401 is received and recovery is triggered.
   * Used to inject custom recovery logic (e.g., token refresh endpoint).
   * If not provided, recovery will fail and session will be cleared.
   */
  onRecoveryNeeded?: (signal: AbortSignal) => Promise<void>;
}

/**
 * Enhanced API client for authenticated requests.
 * Handles 401 responses by coordinating recovery across concurrent requests.
 *
 * Usage:
 * ```
 * const result = await authenticatedApiClient<PaymentType>({
 *   path: '/payments',
 *   method: 'GET',
 *   onRecoveryNeeded: async (signal) => {
 *     // Attempt token refresh or re-auth
 *     const response = await apiClient({...});
 *     const { token } = response;
 *     tokenManager.setToken(token);
 *   },
 * });
 * ```
 */
export async function authenticatedApiClient<TResponse>({
  path,
  headers = {},
  shouldRetryAfterRecovery,
  onRecoveryNeeded,
  ...init
}: AuthenticatedApiClientOptions): Promise<TResponse> {
  const tokenManager = TokenManager.getInstance();
  const coordinator = SessionCoordinator.getInstance();
  const token = tokenManager.getToken();

  // Determine if this is a mutation (POST, PUT, PATCH, DELETE)
  const method = (init.method || 'GET').toUpperCase();
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const shouldRetry =
    shouldRetryAfterRecovery !== undefined
      ? shouldRetryAfterRecovery
      : !isMutation;

  // Add token to headers if available
  const authHeaders = token ? bearer(token) : {};

  try {
    return await apiClient<TResponse>({
      path,
      headers: { ...authHeaders, ...headers },
      ...init,
    });
  } catch (error) {
    // Check if this is a 401 Unauthorized
    const is401 = error instanceof Error && error.message.includes('401');

    if (!is401) {
      throw error; // Not a 401; propagate
    }

    // Handle 401: attempt recovery via SessionCoordinator
    if (!onRecoveryNeeded) {
      // No recovery mechanism provided; fail
      throw new Error('Session expired and no recovery mechanism available');
    }

    try {
      // Coordinate recovery (deduplicates concurrent 401s)
      await coordinator.handle401(onRecoveryNeeded);

      // Recovery succeeded; retry the original request
      if (shouldRetry) {
        const newToken = tokenManager.getToken();
        const retryHeaders = newToken ? bearer(newToken) : {};

        return await apiClient<TResponse>({
          path,
          headers: { ...retryHeaders, ...headers },
          ...init,
        });
      } else {
        // Mutation not retried after recovery (caller must retry)
        throw new Error('Mutation failed with 401; caller must retry');
      }
    } catch (recoveryError) {
      // Recovery failed; propagate
      throw recoveryError;
    }
  }
}

/**
 * Batch request handler: executes multiple requests with shared recovery logic.
 * Useful for cases where multiple requests may fail simultaneously.
 *
 * If any request returns 401, triggers recovery once and retries all failed requests.
 */
export async function batchAuthenticatedApiClient<TResponse>(
  requests: (AuthenticatedApiClientOptions & { id: string })[],
  onRecoveryNeeded: (signal: AbortSignal) => Promise<void>,
): Promise<Map<string, TResponse | Error>> {
  const coordinator = SessionCoordinator.getInstance();
  const results = new Map<string, TResponse | Error>();

  // Execute all requests
  const promises = requests.map(async ({ id, ...options }) => {
    try {
      const result = await authenticatedApiClient<TResponse>({
        ...options,
        onRecoveryNeeded,
      });
      results.set(id, result);
    } catch (error) {
      results.set(id, error instanceof Error ? error : new Error(String(error)));
    }
  });

  await Promise.all(promises);
  return results;
}

export function createAuthHeaders(token: string): Record<string, string> {
  return bearer(token);
}
