/**
 * Tests for TokenManager:
 * - Token storage (in-memory, never persisted)
 * - Token rotation (atomic, no race conditions)
 * - Token expiry (pre-emptive clearing)
 */

import { TokenManager } from '../token-manager';

describe('TokenManager', () => {
  beforeEach(() => {
    TokenManager.reset();
  });

  afterEach(() => {
    TokenManager.reset();
  });

  describe('token storage', () => {
    it('should store and retrieve token', () => {
      const manager = TokenManager.getInstance();
      const token = 'test-jwt-token-12345';

      manager.setToken(token);

      expect(manager.getToken()).toBe(token);
      expect(manager.hasToken()).toBe(true);
    });

    it('should return null when no token is set', () => {
      const manager = TokenManager.getInstance();

      expect(manager.getToken()).toBeNull();
      expect(manager.hasToken()).toBe(false);
    });

    it('should clear token on clearToken()', () => {
      const manager = TokenManager.getInstance();

      manager.setToken('token-123');
      expect(manager.hasToken()).toBe(true);

      manager.clearToken();
      expect(manager.getToken()).toBeNull();
      expect(manager.hasToken()).toBe(false);
    });

    it('should not expose full payload via getToken()', () => {
      const manager = TokenManager.getInstance();
      const token = 'secret-token';
      const expiresAt = Date.now() + 60000;

      manager.setToken(token, expiresAt);

      const retrieved = manager.getToken();
      expect(retrieved).toBe(token);
      // Payload should be internal only
      expect((manager as any).token).toHaveProperty('token', token);
      expect((manager as any).token).toHaveProperty('expiresAt', expiresAt);
    });

    it('should never store token in localStorage or sessionStorage', () => {
      const manager = TokenManager.getInstance();

      manager.setToken('secret-token-12345');

      // Token should not be in any storage
      expect(localStorage.getItem('earnproof.session')).toBeNull();
      expect(sessionStorage.getItem('earnproof.session')).toBeNull();
    });
  });

  describe('token expiry', () => {
    it('should detect expired token and return null', () => {
      const manager = TokenManager.getInstance();
      const token = 'token-123';
      const expiresAt = Date.now() - 1000; // Expired 1 second ago

      manager.setToken(token, expiresAt);

      expect(manager.getToken()).toBeNull(); // Should be null when expired
      expect(manager.hasToken()).toBe(false);
    });

    it('should use 30-second grace period before expiry', () => {
      const manager = TokenManager.getInstance();
      const token = 'token-123';
      const expiresAt = Date.now() + 20000; // Expires in 20 seconds

      manager.setToken(token, expiresAt);

      // Should still be valid (not within grace period)
      expect(manager.getToken()).toBe(token);

      // Grace period is 30 seconds, so 20 seconds until expiry is treated as expired
      const expiresAtSoon = Date.now() + 29999;
      manager.setToken(token, expiresAtSoon);
      expect(manager.getToken()).toBeNull(); // Within grace period, treated as expired
    });

    it('should return expiry time', () => {
      const manager = TokenManager.getInstance();
      const expiresAt = Date.now() + 60000;

      manager.setToken('token-123', expiresAt);

      expect(manager.getExpiryTime()).toBe(expiresAt);
    });

    it('should return null for expiry time when no token', () => {
      const manager = TokenManager.getInstance();

      expect(manager.getExpiryTime()).toBeNull();
    });
  });

  describe('token rotation', () => {
    it('should rotate token atomically', async () => {
      const manager = TokenManager.getInstance();
      const oldToken = 'old-token';
      const newToken = 'new-token';

      manager.setToken(oldToken);
      expect(manager.getToken()).toBe(oldToken);

      await manager.rotateToken(newToken);
      expect(manager.getToken()).toBe(newToken);
    });

    it('should prevent concurrent rotations', async () => {
      const manager = TokenManager.getInstance();
      let rotationStarted = false;

      const slowRotation = manager.rotateToken('token-1');
      rotationStarted = true;

      // Attempt second rotation while first is in progress
      const secondRotation = manager
        .rotateToken('token-2')
        .catch((error) => error);

      const result = await secondRotation;

      expect(result).toBeInstanceOf(Error);
      expect((result as Error).message).toContain(
        'Token rotation already in progress',
      );
    });

    it('should update issuedAt on rotation', async () => {
      const manager = TokenManager.getInstance();
      const beforeRotation = Date.now();

      manager.setToken('token-1');

      await new Promise((resolve) => setTimeout(resolve, 10));

      const afterFirstSet = (manager as any).token.issuedAt;

      await manager.rotateToken('token-2');

      const afterRotation = (manager as any).token.issuedAt;

      expect(afterRotation).toBeGreaterThan(afterFirstSet);
    });

    it('should update expiry on rotation', async () => {
      const manager = TokenManager.getInstance();

      manager.setToken('token-1', Date.now() + 60000);
      const oldExpiry = manager.getExpiryTime();

      const newExpiry = Date.now() + 120000;
      await manager.rotateToken('token-2', newExpiry);

      expect(manager.getExpiryTime()).toBe(newExpiry);
      expect(manager.getExpiryTime()).not.toBe(oldExpiry);
    });

    it('should notify listeners on rotation', (done) => {
      const manager = TokenManager.getInstance();
      let callCount = 0;

      manager.onTokenChange(() => {
        callCount++;
        if (callCount === 1) {
          // First call from setToken
          manager.rotateToken('new-token').catch(() => {});
        } else if (callCount === 2) {
          // Second call from rotateToken
          done();
        }
      });

      manager.setToken('initial-token');
    });
  });

  describe('token change listeners', () => {
    it('should notify listeners on token set', (done) => {
      const manager = TokenManager.getInstance();
      const unsubscribe = manager.onTokenChange(() => {
        expect(manager.getToken()).toBe('new-token');
        unsubscribe();
        done();
      });

      manager.setToken('new-token');
    });

    it('should notify listeners on token clear', (done) => {
      const manager = TokenManager.getInstance();

      manager.setToken('token-123');

      const unsubscribe = manager.onTokenChange(() => {
        expect(manager.getToken()).toBeNull();
        unsubscribe();
        done();
      });

      manager.clearToken();
    });

    it('should handle multiple listeners', () => {
      const manager = TokenManager.getInstance();
      const calls: string[] = [];

      const unsub1 = manager.onTokenChange(() => calls.push('listener1'));
      const unsub2 = manager.onTokenChange(() => calls.push('listener2'));

      manager.setToken('token');

      expect(calls).toContain('listener1');
      expect(calls).toContain('listener2');

      unsub1();
      unsub2();
    });

    it('should allow listener unsubscription', () => {
      const manager = TokenManager.getInstance();
      const calls: number[] = [];

      const unsubscribe = manager.onTokenChange(() => calls.push(1));

      manager.setToken('token-1');
      expect(calls.length).toBe(1);

      unsubscribe();

      manager.setToken('token-2');
      expect(calls.length).toBe(1); // Should not increase
    });

    it('should not crash if listener throws', () => {
      const manager = TokenManager.getInstance();
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      manager.onTokenChange(() => {
        throw new Error('Listener error');
      });

      manager.setToken('token');

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance on multiple calls', () => {
      const manager1 = TokenManager.getInstance();
      const manager2 = TokenManager.getInstance();

      expect(manager1).toBe(manager2);
    });

    it('should create new instance after reset', () => {
      const manager1 = TokenManager.getInstance();
      manager1.setToken('token-1');

      TokenManager.reset();

      const manager2 = TokenManager.getInstance();
      expect(manager2).not.toBe(manager1);
      expect(manager2.getToken()).toBeNull();
    });
  });
});
