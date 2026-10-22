/**
 * Wallet network compatibility validation.
 *
 * Compares wallet-reported network context against application configuration
 * to determine compatibility before signing operations.
 *
 * All signing operations (authentication and proof) must verify compatibility
 * as "compatible" before dispatching signature requests. This centralized
 * validation prevents bypassing network checks through UI state manipulation.
 */

import { appConfig } from "@/config/app";
import type {
  ExpectedNetworkConfig,
  NetworkCompatibility,
  NetworkCompatibilityCheckResult,
  WalletNetworkContext,
  WalletNetworkDetectionResult,
} from "./types";

/**
 * Get the expected Stellar network configuration from app config.
 *
 * This is the authoritative source of truth for which network the application
 * is configured to use. All wallet network detection is compared against this.
 *
 * @returns Trusted network configuration from validated environment.
 */
export function getExpectedNetworkConfig(): ExpectedNetworkConfig {
  return {
    network: appConfig.stellarNetwork,
    networkPassphrase: appConfig.stellarNetworkPassphrase,
  };
}

/**
 * Normalize a network value to a safe display name.
 *
 * Removes sensitive information and normalizes the value for user display.
 * Never exposes full passphrases or internal implementation details.
 *
 * @param value - Raw network value from wallet or config.
 * @returns User-friendly display name, safe to show in UI.
 */
function normalizeNetworkDisplay(value: string | undefined): string {
  if (!value || typeof value !== "string") {
    return "Unknown";
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return "Unknown";
  }

  // Map known Stellar networks to friendly names.
  // Only display safe, public network names. Never show full passphrases.
  const networkMap: Record<string, string> = {
    testnet: "Testnet",
    "Test SDF Network ; September 2015": "Testnet",
    public: "Public",
    "Public Global Stellar Network ; September 2015": "Public",
  };

  return networkMap[trimmed] || "Unrecognized Network";
}

/**
 * Detect the network from wallet-reported context.
 *
 * Wallet network detection varies by wallet version:
 * - Freighter v5+: Reports network passphrase in signMessage response.
 * - Earlier versions: No network metadata available.
 * - Unsupported wallets: No network detection capability.
 *
 * @param walletNetworkContext - Network metadata from wallet.
 * @returns Detected network value, if available.
 */
function detectNetworkFromWallet(
  walletNetworkContext: WalletNetworkContext,
): string | undefined {
  // Try passphrase first (primary source from Freighter signMessage).
  if (walletNetworkContext.networkPassphrase) {
    return walletNetworkContext.networkPassphrase;
  }

  // Fall back to network name if provided.
  if (walletNetworkContext.network) {
    return walletNetworkContext.network;
  }

  return undefined;
}

/**
 * Compare wallet-detected network against application configuration.
 *
 * Determines compatibility state based on wallet network metadata.
 * Handles missing metadata, unsupported wallets, and mismatches gracefully.
 *
 * @param walletNetworkContext - Network info from wallet.
 * @param expectedConfig - Application's configured network.
 * @returns Detection result with compatibility state and display values.
 */
export function detectNetworkCompatibility(
  walletNetworkContext: WalletNetworkContext,
  expectedConfig: ExpectedNetworkConfig,
): WalletNetworkDetectionResult {
  const detectedNetwork = detectNetworkFromWallet(walletNetworkContext);

  // No network metadata available from wallet.
  if (!detectedNetwork) {
    return {
      compatibility: "unknown",
      expectedNetwork: expectedConfig.network,
      reason: "Wallet does not report network information",
    };
  }

  // Compare detected network against expected passphrase (primary).
  // Check both exact match and normalized comparison.
  if (
    detectedNetwork === expectedConfig.networkPassphrase ||
    detectedNetwork === expectedConfig.network
  ) {
    return {
      compatibility: "compatible",
      detectedNetwork,
      expectedNetwork: expectedConfig.network,
    };
  }

  // Network mismatch: wallet is on a different network than configured.
  return {
    compatibility: "incompatible",
    detectedNetwork,
    expectedNetwork: expectedConfig.network,
    reason: `Wallet is on ${normalizeNetworkDisplay(detectedNetwork)}, expected ${normalizeNetworkDisplay(expectedConfig.networkPassphrase)}`,
  };
}

/**
 * Create a normalized check result for application use.
 *
 * Converts raw detection result into a format suitable for UI display
 * and signing operation validation. Ensures no sensitive information
 * is exposed in user-facing fields.
 *
 * @param detectionResult - Raw detection result from detectNetworkCompatibility.
 * @returns Normalized result with display values and guidance.
 */
export function createCompatibilityCheckResult(
  detectionResult: WalletNetworkDetectionResult,
): NetworkCompatibilityCheckResult {
  const isValid =
    detectionResult.compatibility === "compatible";

  const displayExpectedNetwork = normalizeNetworkDisplay(
    detectionResult.expectedNetwork === "testnet"
      ? "Test SDF Network ; September 2015"
      : detectionResult.expectedNetwork,
  );

  const displayDetectedNetwork = detectionResult.detectedNetwork
    ? normalizeNetworkDisplay(detectionResult.detectedNetwork)
    : undefined;

  let recoveryGuidance: string | undefined;

  if (detectionResult.compatibility === "incompatible") {
    recoveryGuidance =
      `Your wallet is connected to ${displayDetectedNetwork}. ` +
      `Switch it to ${displayExpectedNetwork} and try again.`;
  } else if (detectionResult.compatibility === "unknown") {
    recoveryGuidance =
      `Your wallet does not report network information. ` +
      `Ensure you are using a recent version of your wallet and try again.`;
  } else if (detectionResult.compatibility === "unsupported") {
    recoveryGuidance =
      `Your wallet does not support network detection. ` +
      `Verify manually that it is connected to ${displayExpectedNetwork}.`;
  }

  return {
    state: detectionResult.compatibility,
    isValid,
    displayExpectedNetwork,
    displayDetectedNetwork,
    recoveryGuidance,
  };
}

/**
 * Validate wallet network compatibility before a signing operation.
 *
 * This is the primary gate for blocking signing operations when
 * network compatibility is unknown or invalid.
 *
 * Used by:
 * - Authentication challenge signing
 * - Proof creation signing
 *
 * @param walletNetworkContext - Network metadata from wallet.
 * @returns Normalized compatibility check result.
 */
export function validateNetworkCompatibility(
  walletNetworkContext: WalletNetworkContext,
): NetworkCompatibilityCheckResult {
  const expectedConfig = getExpectedNetworkConfig();
  const detectionResult = detectNetworkCompatibility(
    walletNetworkContext,
    expectedConfig,
  );
  return createCompatibilityCheckResult(detectionResult);
}

/**
 * Determine if a compatibility state allows signing.
 *
 * Signing is only allowed when compatibility is explicitly "compatible".
 * Any other state (incompatible, unknown, unsupported) blocks signing
 * and surfaces recovery guidance to the user.
 *
 * @param compatibility - Network compatibility state.
 * @returns True if signing is allowed, false otherwise.
 */
export function isSigningAllowed(compatibility: NetworkCompatibility): boolean {
  return compatibility === "compatible";
}
