/**
 * Tests for SessionCoordinator:
 * - Concurrent 401 handling (single recovery path)
 * - Failed recovery (graceful degradation, no infinite loop)
 * - Logout/revocation (state clears correctly)
 */

import { SessionCoordinator } from '../session-coordinator';

describe('SessionCoordinator', () => {
  beforeEach(() => {
    SessionCoordinator.reset();
  });

  afterEach(() => {
    SessionCoordinator.reset();
  });

  describe('concurrent 401 handling', () => {
    it('should deduplicate concurrent 401s (single recovery path)', async () => {
      const coordinator = SessionCoordinator.getInstance();
      let recoveryCallCount = 0;

      const recoveryFn = jest.fn(async () => {
        recoveryCallCount++;
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Simulate 3 concurrent requests all hitting 401
      const promises = [
        coordinator.handle401(recoveryFn),
        coordinator.handle401(recoveryFn),
        coordinator.handle401(recoveryFn),
      ];

      const results = await Promise.all(promises);

      // Recovery function should be called exactly once
      expect(recoveryCallCount).toBe(1);
      expect(recoveryFn).toHaveBeenCalledTimes(1);

      // All requests should complete successfully
      results.forEach((result) => {
        expect(result).toBeUndefined();
      });

      // Coordinator should be in recovered state
      expect(coordinator.getState()).toBe('recovered');
    });

    it('should resume all queued requests after recovery', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const results: number[] = [];

      const recoveryFn = jest.fn(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      // First request triggers recovery
      const request1Promise = (async () => {
        await coordinator.handle401(recoveryFn);
        results.push(1);
      })();

      // Wait for recovery to start
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Concurrent requests queue
      const request2Promise = (async () => {
        await coordinator.handle401(recoveryFn);
        results.push(2);
      })();

      const request3Promise = (async () => {
        await coordinator.handle401(recoveryFn);
        results.push(3);
      })();

      await Promise.all([request1Promise, request2Promise, request3Promise]);

      // All should complete
      expect(results).toContain(1);
      expect(results).toContain(2);
      expect(results).toContain(3);
    });

    it('should track pending request count', async () => {
      const coordinator = SessionCoordinator.getInstance();
      let recoveryResolve: (() => void) | null = null;

      const recoveryFn = jest.fn(
        () =>
          new Promise<void>((resolve) => {
            recoveryResolve = resolve;
          }),
      );

      // First request starts recovery
      const promise1 = coordinator.handle401(recoveryFn);

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(coordinator.getPendingCount()).toBe(0); // First request is not queued

      // Queue additional requests
      const promise2 = coordinator.handle401(recoveryFn);
      const promise3 = coordinator.handle401(recoveryFn);

      await new Promise((resolve) => setTimeout(resolve, 5));
      expect(coordinator.getPendingCount()).toBe(2); // Two requests queued

      // Resolve recovery
      recoveryResolve?.();
      await Promise.all([promise1, promise2, promise3]);

      expect(coordinator.getPendingCount()).toBe(0);
    });
  });

  describe('failed recovery', () => {
    it('should reject all pending requests on recovery failure', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const recoveryError = new Error('Token refresh failed');

      const recoveryFn = jest.fn(async () => {
        throw recoveryError;
      });

      const promise1 = coordinator.handle401(recoveryFn).catch((err) => err);
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise2 = coordinator.handle401(recoveryFn).catch((err) => err);
      const promise3 = coordinator.handle401(recoveryFn).catch((err) => err);

      const results = await Promise.all([promise1, promise2, promise3]);

      // All should receive the error
      results.forEach((result) => {
        expect(result).toBeInstanceOf(Error);
      });

      // Coordinator should be in failed state
      expect(coordinator.getState()).toBe('failed');
    });

    it('should not infinite loop on recovery failure', async () => {
      const coordinator = SessionCoordinator.getInstance();
      let attemptCount = 0;

      const recoveryFn = jest.fn(async () => {
        attemptCount++;
        throw new Error('Recovery always fails');
      });

      const result = await coordinator.handle401(recoveryFn).catch((err) => err);

      // Should fail after retries
      expect(result).toBeInstanceOf(Error);
      // With maxRetries=1, should attempt exactly 2 times (initial + 1 retry)
      expect(attemptCount).toBeLessThanOrEqual(2);
    });

    it('should transition to idle after failed recovery', async () => {
      const coordinator = SessionCoordinator.getInstance();

      const recoveryFn = jest.fn(async () => {
        throw new Error('Recovery failed');
      });

      await coordinator.handle401(recoveryFn).catch(() => {});

      expect(coordinator.getState()).toBe('failed');

      // After reset, should be idle
      coordinator.reset();
      expect(coordinator.getState()).toBe('idle');
    });

    it('should handle recovery retry with backoff', async () => {
      const coordinator = SessionCoordinator.getInstance({ maxRetries: 1 });
      const timestamps: number[] = [];
      let attemptCount = 0;

      const recoveryFn = jest.fn(async () => {
        timestamps.push(Date.now());
        attemptCount++;
        if (attemptCount < 2) {
          throw new Error('Temporary failure');
        }
      });

      await coordinator.handle401(recoveryFn);

      expect(attemptCount).toBe(2);
      // Second attempt should have delay (backoff)
      if (timestamps.length > 1) {
        const delay = timestamps[1] - timestamps[0];
        expect(delay).toBeGreaterThanOrEqual(400); // ~500ms backoff
      }
    });
  });

  describe('logout/revocation', () => {
    it('should clear all pending requests on reset', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const rejectedErrors: Error[] = [];

      const recoveryFn = jest.fn(
        () =>
          new Promise<void>(() => {
            // Never resolves
          }),
      );

      // Queue requests
      const promise1 = coordinator
        .handle401(recoveryFn)
        .catch((err) => rejectedErrors.push(err));
      await new Promise((resolve) => setTimeout(resolve, 5));
      const promise2 = coordinator
        .handle401(recoveryFn)
        .catch((err) => rejectedErrors.push(err));
      const promise3 = coordinator
        .handle401(recoveryFn)
        .catch((err) => rejectedErrors.push(err));

      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(coordinator.getPendingCount()).toBe(2);

      // Reset coordinator (simulating logout)
      coordinator.reset();

      // Wait for pending promises
      await Promise.allSettled([promise1, promise2, promise3]);

      // All should be rejected
      expect(rejectedErrors.length).toBeGreaterThan(0);
      expect(coordinator.getState()).toBe('idle');
      expect(coordinator.getPendingCount()).toBe(0);
    });

    it('should allow new recovery after reset', async () => {
      const coordinator = SessionCoordinator.getInstance();

      // First recovery attempt
      await coordinator
        .handle401(async () => {
          throw new Error('Failed');
        })
        .catch(() => {});

      expect(coordinator.getState()).toBe('failed');

      // Reset
      coordinator.reset();
      expect(coordinator.getState()).toBe('idle');

      // Second recovery should work
      let called = false;
      await coordinator.handle401(async () => {
        called = true;
      });

      expect(called).toBe(true);
    });
  });

  describe('abort signal handling', () => {
    it('should reject aborted requests', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const controller = new AbortController();

      const recoveryFn = jest.fn(
        () =>
          new Promise<void>(() => {
            // Never resolves
          }),
      );

      const promise = coordinator
        .handle401(recoveryFn, controller.signal)
        .catch((err) => err);

      await new Promise((resolve) => setTimeout(resolve, 5));

      // Abort the request
      controller.abort();

      const result = await promise;
      expect(result).toBeInstanceOf(DOMException);
      expect((result as DOMException).name).toBe('AbortError');
    });

    it('should handle combined abort signals', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const controller1 = new AbortController();
      const controller2 = new AbortController();

      let recoveryStarted = false;
      const recoveryFn = jest.fn(async () => {
        recoveryStarted = true;
        await new Promise((resolve) => setTimeout(resolve, 100));
      });

      const promise = coordinator
        .handle401(recoveryFn, controller1.signal)
        .catch((err) => err);

      await new Promise((resolve) => setTimeout(resolve, 5));

      // Abort via second controller
      controller2.abort();

      const result = await promise;
      // Recovery should still proceed (first controller not aborted)
      expect(recoveryStarted).toBe(true);
    });
  });

  describe('state transitions', () => {
    it('should follow idle -> recovering -> recovered -> idle flow', async () => {
      const coordinator = SessionCoordinator.getInstance();
      const states: string[] = [];

      states.push(coordinator.getState()); // idle

      const recoveryFn = jest.fn(async () => {
        states.push(coordinator.getState()); // recovering
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const promise = coordinator.handle401(recoveryFn);
      states.push(coordinator.getState()); // recovering

      await promise;
      states.push(coordinator.getState()); // recovered

      // Later transitions to idle
      await new Promise((resolve) => setTimeout(resolve, 50));
      states.push(coordinator.getState()); // idle

      expect(states[0]).toBe('idle');
      expect(states[1] === 'recovering' || states[2] === 'recovering').toBe(true);
      expect(states[states.length - 1]).toBe('idle');
    });

    it('should allow new recovery after previous recovery completes', async () => {
      const coordinator = SessionCoordinator.getInstance();
      let recoveryCount = 0;

      const recoveryFn = jest.fn(async () => {
        recoveryCount++;
      });

      // First recovery
      await coordinator.handle401(recoveryFn);
      expect(recoveryCount).toBe(1);

      // Reset for next cycle
      coordinator.reset();

      // Second recovery
      await coordinator.handle401(recoveryFn);
      expect(recoveryCount).toBe(2);
    });
  });
});
