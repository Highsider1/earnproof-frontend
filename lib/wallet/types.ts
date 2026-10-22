/**
 * Wallet network context and compatibility types.
 *
 * Provides a type-safe interface for wallet network detection and
 * validation against application configuration.
 */

/**
 * Compatibility state of wallet network with application configuration.
 *
 * - compatible: Wallet network matches application configuration.
 * - incompatible: Wallet network does not match application configuration.
 * - unknown: Network compatibility cannot be determined (missing wallet metadata).
 * - unsupported: Wallet does not support network detection or reporting.
 */
export type NetworkCompatibility =
  | "compatible"
  | "incompatible"
  | "unknown"
  | "unsupported";

/**
 * Wallet network detection result.
 *
 * Contains network metadata reported by the wallet, if available,
 * along with the compatibility determination.
 */
export type WalletNetworkDetectionResult = {
  compatibility: NetworkCompatibility;
  detectedNetwork?: string;
  expectedNetwork: string;
  reason?: string;
};

/**
 * Wallet network context as reported by the wallet.
 *
 * Freighter v5+ reports network information; earlier versions
 * do not expose this metadata.
 */
export type WalletNetworkContext = {
  network?: string;
  networkPassphrase?: string;
};

/**
 * Expected Stellar network configuration from the application.
 *
 * Derived from validated environment configuration and trusted
 * by signing operations as the authoritative network specification.
 */
export type ExpectedNetworkConfig = {
  network: string;
  networkPassphrase: string;
};

/**
 * Wallet network compatibility validation result.
 *
 * Encapsulates the complete result of validating wallet-reported
 * network context against application configuration, including
 * user-friendly display names and recovery guidance.
 */
export type NetworkCompatibilityCheckResult = {
  state: NetworkCompatibility;
  isValid: boolean;
  displayExpectedNetwork: string;
  displayDetectedNetwork?: string;
  recoveryGuidance?: string;
};

/**
 * Wallet account change event payload.
 *
 * Contains the previous and current wallet address, if different,
 * signaling that network compatibility should be re-evaluated.
 */
export type WalletAccountChangeEvent = {
  previousAddress?: string;
  currentAddress: string;
};

/**
 * Wallet network change event payload.
 *
 * Contains the previous and current wallet network, if different,
 * signaling that network compatibility should be re-evaluated.
 */
export type WalletNetworkChangeEvent = {
  previousNetwork?: string;
  currentNetwork: string;
};
