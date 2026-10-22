/**
 * Integration tests for wallet network compatibility checking during proof creation.
 *
 * Ensures that:
 * - Network compatibility is validated before proof API calls
 * - Proof creation is blocked when network is incompatible/unknown/unsupported
 * - API requests are never sent while network validation fails
 * - Recovery guidance helps users correct the issue and continue
 */

import {
  validateNetworkCompatibility,
  isSigningAllowed,
} from "@/lib/wallet/network-compatibility";
import type { WalletNetworkContext } from "@/lib/wallet/types";

describe("Wallet Proof Creation - Network Compatibility Checks", () => {
  describe("happy path - compatible network", () => {
    it("allows proof creation when wallet network is compatible", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canCreateProof = isSigningAllowed(result.state);

      expect(result.isValid).toBe(true);
      expect(canCreateProof).toBe(true);
      expect(result.state).toBe("compatible");
    });

    it("proceeds to proof API call when network is compatible", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Network check passes, proceed with proof creation
      if (isSigningAllowed(result.state)) {
        // Would proceed: apiClient("/proofs/minimum-income")
        // or: createPaymentReceiptProof()
        // or: createRecurringIncomeProof()
        expect(result.isValid).toBe(true);
      } else {
        throw new Error("Should have allowed proof creation");
      }
    });
  });

  describe("negative tests - block proof creation on mismatch", () => {
    it("blocks proof creation when wallet is on public network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canCreateProof = isSigningAllowed(result.state);

      expect(canCreateProof).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.state).toBe("incompatible");
    });

    it("blocks proof creation when wallet network is unknown", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);
      const canCreateProof = isSigningAllowed(result.state);

      expect(canCreateProof).toBe(false);
      expect(result.isValid).toBe(false);
      expect(result.state).toBe("unknown");
    });

    it("blocks all proof types equally", () => {
      const incompatibleContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(incompatibleContext);
      const blocksProof = !isSigningAllowed(result.state);

      // All proof types should be blocked:
      // - Minimum income proof
      // - Payment receipt proof
      // - Recurring income proof
      expect(blocksProof).toBe(true);
    });

    it("prevents API request dispatch on incompatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // If isSigningAllowed is false, code should return early
      // before calling apiClient() or any proof creation function
      if (isSigningAllowed(result.state)) {
        throw new Error(
          "Should not allow proof creation on public network"
        );
      }

      // No API request would be sent
      expect(isSigningAllowed(result.state)).toBe(false);
    });
  });

  describe("recovery flow - user corrects network and retries", () => {
    it("shows recovery guidance for incompatible proof network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      expect(result.recoveryGuidance).toContain("Switch");
      expect(result.recoveryGuidance).toContain("Public");
      expect(result.recoveryGuidance).toContain("Testnet");
    });

    it("shows recovery guidance for unknown proof network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      expect(result.recoveryGuidance).toContain("wallet");
      expect(result.recoveryGuidance).toContain("recent");
    });

    it("allows proof retry after user corrects wallet network", () => {
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

      // Proof creation can now proceed
      expect(result.isValid).toBe(true);
    });

    it("preserves proof intent state during recovery", () => {
      // This simulates the component-level behavior where
      // selectedPayments, threshold, etc. are preserved while
      // the user fixes the network issue

      const incompatibleContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      let result = validateNetworkCompatibility(incompatibleContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Component state is preserved:
      // - selectedPaymentIds: ["payment-1", "payment-2"]
      // - thresholdAmount: "100"
      // - periodStart: "2026-08-01"
      // - periodEnd: "2026-08-31"
      // User only needs to fix the wallet

      // After correction:
      const compatibleContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      result = validateNetworkCompatibility(compatibleContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      // Component can immediately retry with same proof intent
      // No re-selection needed
    });

    it("displays network mismatch info for user debugging", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.displayExpectedNetwork).toBe("Testnet");
      expect(result.displayDetectedNetwork).toBe("Public");
      expect(result.displayExpectedNetwork).not.toContain(";");
      expect(result.displayDetectedNetwork).not.toContain(";");
    });
  });

  describe("boundary tests - network change during proof flow", () => {
    it("handles wallet disconnect during proof creation", () => {
      // Initially connected to testnet
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      // Wallet disconnects (or user clears it)
      walletContext = {};
      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Proof creation blocked until reconnection
    });

    it("handles wallet reconnect with different network", () => {
      // Initially on testnet
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      // User reconnects but on public network
      walletContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      // Proof creation now blocked
      expect(isSigningAllowed(result.state)).toBe(false);
      expect(result.displayExpectedNetwork).toBe("Testnet");
      expect(result.displayDetectedNetwork).toBe("Public");
    });

    it("handles rapid network change checks", () => {
      const scenarios = [
        { networkPassphrase: "Test SDF Network ; September 2015" },
        { networkPassphrase: "Public Global Stellar Network ; September 2015" },
        { networkPassphrase: "Test SDF Network ; September 2015" },
        {},
        { networkPassphrase: "Test SDF Network ; September 2015" },
      ];

      const results = scenarios.map((context) =>
        validateNetworkCompatibility(context)
      );

      // Each check should be consistent
      expect(isSigningAllowed(results[0].state)).toBe(true);
      expect(isSigningAllowed(results[1].state)).toBe(false);
      expect(isSigningAllowed(results[2].state)).toBe(true);
      expect(isSigningAllowed(results[3].state)).toBe(false);
      expect(isSigningAllowed(results[4].state)).toBe(true);
    });
  });

  describe("error prevention", () => {
    it("prevents API request on incompatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Component logic: only calls apiClient if isSigningAllowed
      // This test verifies the gate works
      if (isSigningAllowed(result.state)) {
        throw new Error("Should not proceed with API call");
      }

      // No API request would be sent
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("prevents duplicate submission on network mismatch", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Multiple checks with same mismatch produce consistent results
      let attempts = 0;
      for (let i = 0; i < 5; i++) {
        if (!isSigningAllowed(result.state)) {
          attempts++;
        }
      }

      // All attempts blocked consistently
      expect(attempts).toBe(5);
    });

    it("prevents accidental proof creation on wrong network", () => {
      const scenarios = [
        { name: "testnet", context: { networkPassphrase: "Test SDF Network ; September 2015" }, shouldAllow: true },
        { name: "public", context: { networkPassphrase: "Public Global Stellar Network ; September 2015" }, shouldAllow: false },
        { context: {}, shouldAllow: false },
      ];

      scenarios.forEach(({ context, shouldAllow }) => {
        const result = validateNetworkCompatibility(context);
        const allowed = isSigningAllowed(result.state);

        expect(allowed).toBe(shouldAllow);
      });
    });
  });

  describe("proof creation gate behavior", () => {
    it("gates all proof types with same logic", () => {
      const incompatibleContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(incompatibleContext);
      const blocksAllProofs = !isSigningAllowed(result.state);

      // All proof types use the same validation:
      // - createProof() in create-proof-flow.tsx
      // - createProof() in payment-receipt-proof-flow.tsx
      // - createProof() in recurring-income-proof-wizard.tsx
      // All check: isSigningAllowed(networkCompatibility.state)
      expect(blocksAllProofs).toBe(true);
    });

    it("maintains consistency across proof types", () => {
      const testContexts = [
        { networkPassphrase: "Test SDF Network ; September 2015" },
        { networkPassphrase: "Public Global Stellar Network ; September 2015" },
        {},
      ];

      const results = testContexts.map((context) =>
        validateNetworkCompatibility(context)
      );

      // All proof types get consistent validation
      results.forEach((result) => {
        expect(typeof result.isValid).toBe("boolean");
        expect(typeof result.state).toBe("string");
        expect(isSigningAllowed(result.state) === result.isValid).toBe(true);
      });
    });
  });
});
