/**
 * WalletDetector: Monitors Freighter wallet account and network changes.
 *
 * Detects when:
 * - User switches to a different Freighter account
 * - User switches networks (testnet ↔ mainnet)
 * - Wallet becomes disconnected
 *
 * Signals should be handled to invalidate cached data before render.
 */

import { getFreighterAddress } from '@/components/proofs/freighter-utils';

export interface WalletState {
  address: string | null;
  network: string;
  isConnected: boolean;
  lastChecked: number;
}

export type WalletChangeListener = (
  change: WalletChangeEvent,
  newState: WalletState,
) => void;

export interface WalletChangeEvent {
  type: 'account_changed' | 'network_changed' | 'disconnected' | 'connected';
  previous?: WalletState;
  current: WalletState;
}

/**
 * WalletDetector monitors wallet state and triggers callbacks
 * when account or network changes are detected.
 */
export class WalletDetector {
  private static instance: WalletDetector;
  private state: WalletState;
  private listeners: Set<WalletChangeListener> = new Set();
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private readonly DEFAULT_NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || 'testnet';

  private constructor() {
    this.state = {
      address: null,
      network: this.DEFAULT_NETWORK,
      isConnected: false,
      lastChecked: Date.now(),
    };
  }

  static getInstance(): WalletDetector {
    if (!WalletDetector.instance) {
      WalletDetector.instance = new WalletDetector();
    }
    return WalletDetector.instance;
  }

  /**
   * Initialize wallet detection. Should be called once on app load.
   * Starts periodic checking for wallet changes.
   *
   * @param checkIntervalMs How often to poll wallet state (default: 3000ms)
   */
  async initialize(checkIntervalMs: number = 3000): Promise<void> {
    await this.checkWallet();

    // Check periodically for changes
    this.checkInterval = setInterval(() => {
      this.checkWallet().catch((error) => {
        console.error('Wallet check error:', error);
      });
    }, checkIntervalMs);
  }

  /**
   * Stop wallet detection and cleanup.
   */
  destroy(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  /**
   * Check current wallet state and emit change events if different.
   * Safe to call multiple times; only emits if state actually changed.
   */
  async checkWallet(): Promise<void> {
    try {
      const newAddress = await this.getWalletAddress();
      const newNetwork = this.DEFAULT_NETWORK;
      const isConnected = newAddress !== null;

      const previous = { ...this.state };
      const changed = this.detectChanges(newAddress, newNetwork, isConnected);

      if (changed) {
        this.state = {
          address: newAddress,
          network: newNetwork,
          isConnected,
          lastChecked: Date.now(),
        };

        this.emitChange(changed, previous, this.state);
      }
    } catch (error) {
      // Wallet check failed (Freighter not available or error)
      // Don't treat as error; wallet may be disconnected
      const wasConnected = this.state.isConnected;

      if (wasConnected) {
        this.state = {
          address: null,
          network: this.DEFAULT_NETWORK,
          isConnected: false,
          lastChecked: Date.now(),
        };

        this.emitChange(
          {
            type: 'disconnected',
            current: this.state,
            previous: { ...this.state, address: 'unknown', isConnected: true },
          },
          this.state,
          this.state,
        );
      }
    }
  }

  /**
   * Get the current wallet state (snapshot).
   */
  getState(): WalletState {
    return { ...this.state };
  }

  /**
   * Subscribe to wallet changes.
   * Listener will be called whenever account, network, or connection status changes.
   */
  onChange(listener: WalletChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Force a manual wallet check (e.g., after user clicks "Check Wallet").
   */
  async forceCheck(): Promise<void> {
    await this.checkWallet();
  }

  /**
   * Detect what changed in wallet state.
   */
  private detectChanges(
    newAddress: string | null,
    newNetwork: string,
    isConnected: boolean,
  ): WalletChangeEvent | null {
    const addressChanged = newAddress !== this.state.address;
    const networkChanged = newNetwork !== this.state.network;
    const connectedChanged = isConnected !== this.state.isConnected;

    if (!addressChanged && !networkChanged && !connectedChanged) {
      return null; // No change
    }

    // Determine the type of change
    if (isConnected && !this.state.isConnected) {
      return {
        type: 'connected',
        current: {
          address: newAddress,
          network: newNetwork,
          isConnected,
          lastChecked: Date.now(),
        },
      };
    }

    if (!isConnected && this.state.isConnected) {
      return {
        type: 'disconnected',
        current: {
          address: null,
          network: newNetwork,
          isConnected: false,
          lastChecked: Date.now(),
        },
      };
    }

    if (addressChanged && isConnected) {
      return {
        type: 'account_changed',
        current: {
          address: newAddress,
          network: newNetwork,
          isConnected,
          lastChecked: Date.now(),
        },
      };
    }

    if (networkChanged) {
      return {
        type: 'network_changed',
        current: {
          address: newAddress,
          network: newNetwork,
          isConnected,
          lastChecked: Date.now(),
        },
      };
    }

    return null;
  }

  /**
   * Get current wallet address via Freighter API.
   * Returns null if wallet is disconnected or not available.
   */
  private async getWalletAddress(): Promise<string | null> {
    try {
      const address = await getFreighterAddress();
      return address || null;
    } catch {
      return null;
    }
  }

  /**
   * Emit wallet change event to all listeners.
   */
  private emitChange(
    event: WalletChangeEvent,
    previous: WalletState,
    current: WalletState,
  ): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event, current);
      } catch (error) {
        console.error('Wallet change listener error:', error);
      }
    });
  }

  /**
   * Reset the detector (primarily for testing).
   */
  static reset(): void {
    if (WalletDetector.instance) {
      WalletDetector.instance.destroy();
      WalletDetector.instance.listeners.clear();
    }
    WalletDetector.instance = null as any;
  }
}
