/**
 * SessionCoordinator: Manages concurrent 401 handling and session recovery.
 *
 * Ensures that when multiple requests receive 401 simultaneously,
 * exactly ONE recovery flow is triggered, and all queued requests
 * resume or fail together once recovery resolves.
 */

export type RecoveryState = 'idle' | 'recovering' | 'recovered' | 'failed';

export interface SessionCoordinatorConfig {
  onRecoveryStart?: () => void | Promise<void>;
  onRecoveryComplete?: (success: boolean) => void | Promise<void>;
  maxRetries?: number;
}

export interface PendingRequest {
  resolve: (value?: void) => void;
  reject: (reason?: Error) => void;
  abort?: AbortSignal;
}

/**
 * SessionCoordinator singleton manages:
 * 1. Concurrent 401 deduplication (one recovery per batch)
 * 2. Queuing of in-flight requests during recovery
 * 3. Coordinated state transitions (idle → recovering → recovered/failed → idle)
 * 4. Cleanup and retry logic
 */
export class SessionCoordinator {
  private static instance: SessionCoordinator;

  private state: RecoveryState = 'idle';
  private recoveryPromise: Promise<void> | null = null;
  private pendingRequests: PendingRequest[] = [];
  private config: SessionCoordinatorConfig;
  private recoveryRetries = 0;

  private constructor(config: SessionCoordinatorConfig = {}) {
    this.config = {
      maxRetries: 1,
      ...config,
    };
  }

  /**
   * Get or create the singleton instance.
   * Safe to call multiple times; returns same instance.
   */
  static getInstance(config?: SessionCoordinatorConfig): SessionCoordinator {
    if (!SessionCoordinator.instance) {
      SessionCoordinator.instance = new SessionCoordinator(config);
    }
    return SessionCoordinator.instance;
  }

  /**
   * Reset the coordinator (primarily for testing).
   */
  static reset(): void {
    if (SessionCoordinator.instance) {
      SessionCoordinator.instance.clearPendingRequests();
      SessionCoordinator.instance.state = 'idle';
      SessionCoordinator.instance.recoveryRetries = 0;
    }
    SessionCoordinator.instance = null as any;
  }

  /**
   * Handle a 401 response. If already recovering, queue the request.
   * If idle, start recovery and queue the request.
   *
   * @param recoveryFn Async function that attempts recovery (token refresh, re-auth, etc.)
   * @returns Promise that resolves when recovery completes successfully,
   *          or rejects if recovery fails.
   */
  async handle401(
    recoveryFn: (signal: AbortSignal) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    // If a recovery is already in progress, wait for it
    if (this.state === 'recovering' && this.recoveryPromise) {
      return this.queueRequest(signal);
    }

    // If recovery already succeeded/failed in this cycle, use that result
    if (this.state === 'recovered') {
      return; // Recovery succeeded; proceed
    }
    if (this.state === 'failed') {
      throw new Error('Session recovery failed');
    }

    // Start recovery
    this.state = 'recovering';
    this.recoveryRetries = 0;

    this.recoveryPromise = this.executeRecovery(recoveryFn, signal);

    try {
      await this.recoveryPromise;
    } finally {
      this.recoveryPromise = null;
    }
  }

  /**
   * Execute the recovery process with retry logic.
   */
  private async executeRecovery(
    recoveryFn: (signal: AbortSignal) => Promise<void>,
    signal?: AbortSignal,
  ): Promise<void> {
    try {
      await this.config.onRecoveryStart?.();

      const controller = new AbortController();
      const combined = this.combineSignals(signal, controller.signal);

      try {
        await recoveryFn(combined);
        this.state = 'recovered';
        await this.config.onRecoveryComplete?.(true);
        this.resumeAllRequests();
      } catch (error) {
        // Retry once on transient errors
        if (this.recoveryRetries < (this.config.maxRetries ?? 1)) {
          this.recoveryRetries++;
          await new Promise((resolve) => setTimeout(resolve, 500)); // Backoff
          await recoveryFn(combined);
          this.state = 'recovered';
          await this.config.onRecoveryComplete?.(true);
          this.resumeAllRequests();
        } else {
          throw error;
        }
      }
    } catch (error) {
      this.state = 'failed';
      await this.config.onRecoveryComplete?.(false);
      this.rejectAllPendingRequests(
        error instanceof Error ? error : new Error('Session recovery failed'),
      );
    }
  }

  /**
   * Queue a request to wait for recovery to complete.
   */
  private queueRequest(signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
      const request: PendingRequest = { resolve, reject, abort: signal };
      this.pendingRequests.push(request);

      // If abort is signalled, reject this request
      signal?.addEventListener('abort', () => {
        const idx = this.pendingRequests.indexOf(request);
        if (idx !== -1) {
          this.pendingRequests.splice(idx, 1);
        }
        reject(new DOMException('Request aborted', 'AbortError'));
      });
    });
  }

  /**
   * Resume all pending requests (recovery succeeded).
   */
  private resumeAllRequests(): void {
    const requests = this.pendingRequests.splice(0);
    requests.forEach((req) => req.resolve());
    // Reset to idle for next potential 401 batch
    setTimeout(() => {
      if (this.state === 'recovered') {
        this.state = 'idle';
      }
    }, 0);
  }

  /**
   * Reject all pending requests (recovery failed).
   */
  private rejectAllPendingRequests(error: Error): void {
    const requests = this.pendingRequests.splice(0);
    requests.forEach((req) => req.reject(error));
  }

  /**
   * Clear all pending requests (on logout or forced reset).
   */
  private clearPendingRequests(): void {
    const requests = this.pendingRequests.splice(0);
    const error = new Error('Session cleared');
    requests.forEach((req) => req.reject(error));
  }

  /**
   * Force reset to idle state (e.g., after logout or error recovery).
   */
  reset(): void {
    this.clearPendingRequests();
    this.state = 'idle';
    this.recoveryRetries = 0;
  }

  /**
   * Get current recovery state (for testing/debugging).
   */
  getState(): RecoveryState {
    return this.state;
  }

  /**
   * Get pending request count (for testing/debugging).
   */
  getPendingCount(): number {
    return this.pendingRequests.length;
  }

  /**
   * Combine multiple abort signals into one.
   * If any signal is aborted, the combined signal aborts.
   */
  private combineSignals(...signals: (AbortSignal | undefined)[]): AbortSignal {
    const controller = new AbortController();
    const validSignals = signals.filter(Boolean) as AbortSignal[];

    for (const sig of validSignals) {
      if (sig.aborted) {
        controller.abort();
        return controller.signal;
      }
      sig.addEventListener('abort', () => controller.abort());
    }

    return controller.signal;
  }
}
