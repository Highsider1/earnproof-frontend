/**
 * TokenManager: Handles secure token storage, rotation, and lifecycle.
 *
 * - Tokens are stored in memory (never in localStorage for sensitive data)
 * - Token rotation is atomic (all requests updated before any retry)
 * - No token material is logged or sent to analytics
 */

export interface TokenPayload {
  token: string;
  expiresAt?: number; // Unix timestamp in ms
  issuedAt?: number;
}

/**
 * In-memory token storage (never persisted).
 * Survives page reloads only via httpOnly cookies at the HTTP layer,
 * and is refreshed from backend on session check.
 */
export class TokenManager {
  private static instance: TokenManager;
  private token: TokenPayload | null = null;
  private rotationInProgress = false;
  private listeners: Set<() => void> = new Set();

  private constructor() {}

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Set the current token (e.g., after login or rotation).
   * Atomic: updates all internal state before notifying listeners.
   */
  setToken(token: string, expiresAt?: number): void {
    this.token = {
      token,
      expiresAt,
      issuedAt: Date.now(),
    };
    this.notifyListeners();
  }

  /**
   * Get the current token without exposing the full payload.
   * Returns null if no token is set or if expired.
   */
  getToken(): string | null {
    if (!this.token) return null;

    // Check expiry (with 30-second grace period)
    if (this.token.expiresAt && Date.now() > this.token.expiresAt - 30000) {
      // Token is expired or about to expire
      this.clearToken();
      return null;
    }

    return this.token.token;
  }

  /**
   * Rotate the token atomically.
   * Prevents other parts of the system from using partial state.
   */
  async rotateToken(newToken: string, expiresAt?: number): Promise<void> {
    if (this.rotationInProgress) {
      throw new Error('Token rotation already in progress');
    }

    this.rotationInProgress = true;
    try {
      // Atomic update: both fields change together
      this.token = {
        token: newToken,
        expiresAt,
        issuedAt: Date.now(),
      };
      this.notifyListeners();
    } finally {
      this.rotationInProgress = false;
    }
  }

  /**
   * Clear the token (on logout or revocation).
   */
  clearToken(): void {
    this.token = null;
    this.notifyListeners();
  }

  /**
   * Check if a token is currently set (not necessarily valid).
   */
  hasToken(): boolean {
    return this.token !== null && this.getToken() !== null;
  }

  /**
   * Get token expiry time (for pre-emptive refresh logic).
   * Returns null if no token or expiry not set.
   */
  getExpiryTime(): number | null {
    return this.token?.expiresAt ?? null;
  }

  /**
   * Subscribe to token changes.
   * Listener is called whenever token is set, rotated, or cleared.
   */
  onTokenChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of token change.
   * Listeners should not rely on specific token values; they should
   * fetch the token via getToken() if needed.
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener();
      } catch (error) {
        console.error('Token change listener error:', error);
      }
    });
  }

  /**
   * Reset the manager (primarily for testing).
   */
  static reset(): void {
    if (TokenManager.instance) {
      TokenManager.instance.clearToken();
      TokenManager.instance.listeners.clear();
    }
    TokenManager.instance = null as any;
  }
}
