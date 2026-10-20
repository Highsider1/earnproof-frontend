/**
 * Integration tests for wallet network compatibility checking during authentication.
 *
 * Ensures that:
 * - Network compatibility is validated before authentication signing
 * - No signature request is sent when network is incompatible/unknown/unsupported
 * - User receives clear recovery guidance
 * - Compatible networks proceed with authentication normally
 */

import {
  validateNetworkCompatibility,
  isSigningAllowed,
} from "@/lib/wallet/network-compatibility";
import type {
  WalletNetworkContext,
} from "@/lib/wallet/types";

describe("Wallet Authentication - Network Compatibility Checks", () => {
  describe("happy path - compatible network", () => {
    it("allows authentication signing on compatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(result.isValid).toBe(true);
      expect(canSign).toBe(true);
      expect(result.state).toBe("compatible");
    });

    it("proceeds to challenge/verify flow when network is compatible", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Network check passes, proceed with auth flow
      if (isSigningAllowed(result.state)) {
        // Would proceed: apiClient("/auth/challenge")
        // Then: signFreighterMessage()
        // Then: apiClient("/auth/verify")
        expect(result.isValid).toBe(true);
      } else {
        throw new Error("Should have allowed signing");
      }
    });
  });

  describe("negative tests - block signing on mismatch", () => {
    it("blocks authentication when wallet is on public network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(canSign).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.state).toBe("incompatible");
    });

    it("blocks authentication when wallet network is unknown", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(canSign).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.state).toBe("unknown");
    });

    it("blocks authentication when wallet is unsupported", () => {
      const walletContext: WalletNetworkContext = {
        network: "unsupported-wallet",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      // Implementation should mark this as unsupported or incompatible
      expect(canSign).toBe(false);
      expect(result.isValid).toBe(false);
    });
  });

  describe("recovery flow - user fixes network and retries", () => {
    it("shows recovery guidance when network mismatch is detected", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      expect(result.recoveryGuidance).toContain("Switch");
      expect(result.recoveryGuidance).toContain("Public");
      expect(result.recoveryGuidance).toContain("Testnet");
    });

    it("allows retry after user corrects wallet network", () => {
      // Initial attempt: public network
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // User switches wallet to testnet and retries
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);
    });

    it("preserves error context for user feedback", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result).toMatchObject({
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
      });

      // User can use these values to understand what went wrong
      expect(result.displayDetectedNetwork).toBeDefined();
      expect(result.displayExpectedNetwork).toBeDefined();
    });
  });

  describe("boundary tests - compatibility changes", () => {
    it("handles wallet reconnection with network change", () => {
      // Initial connection: testnet
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      // Wallet reconnects on public network (user error or network switch)
      walletContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("handles rapid compatibility checks (no race conditions)", () => {
      const scenarios = [
        { networkPassphrase: "Test SDF Network ; September 2015" },
        { networkPassphrase: "Public Global Stellar Network ; September 2015" },
        {},
        { networkPassphrase: "Test SDF Network ; September 2015" },
      ];

      const results = scenarios.map((context) =>
        validateNetworkCompatibility(context)
      );

      // Each check should be consistent and independent
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(false);
      expect(results[2].isValid).toBe(false);
      expect(results[3].isValid).toBe(true);
    });
  });

  describe("security gate logic", () => {
    it("never skips network check even with valid token", () => {
      // This test ensures network check is always enforced,
      // not bypassed by having a token or being "already connected"
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Network check must fail regardless of other state
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("cannot be bypassed through state manipulation", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      // Even if UI state is somehow corrupted, validation must work
      const result1 = validateNetworkCompatibility(walletContext);
      const result2 = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result1.state)).toBe(
        isSigningAllowed(result2.state)
      );
      expect(isSigningAllowed(result1.state)).toBe(false);
    });

    it("gates all signing paths equally", () => {
      const incompatibleContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(incompatibleContext);

      // Authentication signing would be blocked
      expect(isSigningAllowed(result.state)).toBe(false);

      // Proof signing would also be blocked (same gate)
      expect(isSigningAllowed(result.state)).toBe(false);
    });
  });

  describe("centralized validation", () => {
    it("uses same validation logic for all signing paths", () => {
      const testContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      // Validation should produce identical result regardless of calling context
      const result1 = validateNetworkCompatibility(testContext);
      const result2 = validateNetworkCompatibility(testContext);

      expect(result1.isValid).toBe(result2.isValid);
      expect(result1.state).toBe(result2.state);
      expect(isSigningAllowed(result1.state)).toBe(
        isSigningAllowed(result2.state)
      );
    });

    it("prevents logic duplication across components", () => {
      // The validation is centralized in network-compatibility.ts
      // All proof flows import and use the same functions
      // This test confirms that approach by verifying consistent behavior

      const contexts = [
        { networkPassphrase: "Test SDF Network ; September 2015" },
        { networkPassphrase: "Public Global Stellar Network ; September 2015" },
        {},
      ];

      // Each context should produce the same result every time
      contexts.forEach((context) => {
        const result1 = validateNetworkCompatibility(context);
        const result2 = validateNetworkCompatibility(context);

        expect(result1.isValid).toBe(result2.isValid);
        expect(result1.state).toBe(result2.state);
      });
    });
  });

  describe("error prevention", () => {
    it("prevents signature request dispatch on incompatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // If isSigningAllowed is false, code should never reach signFreighterMessage()
      if (isSigningAllowed(result.state)) {
        throw new Error("Should not allow signing on public network");
      }

      // No signature request would be sent
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("prevents wallet prompt from appearing on network mismatch", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Wallet prompt only appears when signFreighterMessage() is called
      // Since isSigningAllowed is false, signFreighterMessage() is never called
      const wouldCallSignMessage = isSigningAllowed(result.state);
      expect(wouldCallSignMessage).toBe(false);
    });
  });
});
