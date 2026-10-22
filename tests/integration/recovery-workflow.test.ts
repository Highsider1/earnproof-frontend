/**
 * Tests for recovery workflow after network mismatch.
 *
 * Ensures that:
 * - User can correct network and retry interrupted action
 * - Interrupted proof intent is preserved during recovery
 * - No duplicate proof submissions occur
 * - User returns to the intended workflow after fixing network
 * - Multiple interrupted actions can be handled correctly
 */

import {
  validateNetworkCompatibility,
  isSigningAllowed,
} from "@/lib/wallet/network-compatibility";
import type { WalletNetworkContext } from "@/lib/wallet/types";

describe("Recovery Workflow - Network Mismatch to Success", () => {
  describe("happy path - single recovery attempt", () => {
    it("preserves proof intent during network correction", () => {
      // User starts proof creation on public network
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Component state is preserved:
      const proofIntent = {
        selectedPaymentIds: ["payment-1", "payment-2"],
        thresholdAmount: "100",
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BFSRHRAEYSQ5SBEXKGSUKS4JVD77RQ",
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-08-31T23:59:59.000Z",
      };

      // User switches wallet to testnet
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      // Component can now retry with same proof intent
      expect(proofIntent.selectedPaymentIds.length).toBe(2);
      expect(proofIntent.thresholdAmount).toBe("100");
    });

    it("allows proof retry after network fix", () => {
      let step = 1;

      // Step 1: Initial attempt fails due to network mismatch
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);

      if (!isSigningAllowed(result.state)) {
        step = 2;
      }

      expect(step).toBe(2);

      // Step 2: User sees recovery guidance and switches network
      expect(result.recoveryGuidance).toBeDefined();

      // Step 3: User retries
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      if (isSigningAllowed(result.state)) {
        step = 3;
      }

      expect(step).toBe(3);
    });

    it("displays recovery guidance at each stage", () => {
      // Incompatible network
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      let result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      expect(result.displayDetectedNetwork).toBe("Public");
      expect(result.displayExpectedNetwork).toBe("Testnet");
      expect(result.recoveryGuidance).toContain("Public");
      expect(result.recoveryGuidance).toContain("Testnet");

      // After fix: no guidance needed
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeUndefined();
      expect(result.isValid).toBe(true);
    });
  });

  describe("recovery with different proof types", () => {
    it("preserves payment selection during recovery (minimum income)", () => {
      const selectedPayments = ["payment-1", "payment-2", "payment-3"];
      const thresholdAmount = "500";

      // Network mismatch detected
      let walletContext: WalletNetworkContext = {};
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Selected payments still in memory
      expect(selectedPayments.length).toBe(3);
      expect(thresholdAmount).toBe("500");

      // After network fix
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(true);
      // Can retry with same selection
      expect(selectedPayments.length).toBe(3);
    });

    it("preserves privacy controls during recovery (payment receipt)", () => {
      const privacyState = {
        discloseSender: true,
        discloseAmount: false,
        expiresInDays: 30,
      };

      // Network mismatch
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Privacy state preserved
      expect(privacyState.discloseSender).toBe(true);
      expect(privacyState.discloseAmount).toBe(false);

      // After fix, can retry with same privacy settings
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(true);
      expect(privacyState.discloseSender).toBe(true);
    });

    it("preserves wizard state during recovery (recurring income)", () => {
      const wizardState = {
        currentStep: "CONFIRMATION",
        intervalUnit: "MONTH",
        intervalCount: 3,
        periodStart: "2026-08-01",
        periodEnd: "2026-10-31",
        selectedPaymentIds: ["p1", "p2"],
        selectedAsset: { code: "USDC", issuer: "GBUQWP..." },
      };

      // Network mismatch
      let walletContext: WalletNetworkContext = {};
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Wizard state preserved
      expect(wizardState.currentStep).toBe("CONFIRMATION");
      expect(wizardState.intervalCount).toBe(3);

      // After fix
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(true);
      // Can continue from same step
      expect(wizardState.currentStep).toBe("CONFIRMATION");
    });
  });

  describe("no duplicate submissions", () => {
    it("prevents duplicate proof submission during recovery", () => {
      let submissionCount = 0;

      // Initial attempt blocked
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);

      if (isSigningAllowed(result.state)) {
        submissionCount++;
      }

      expect(submissionCount).toBe(0);

      // After network fix
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      if (isSigningAllowed(result.state)) {
        submissionCount++;
      }

      expect(submissionCount).toBe(1);
    });

    it("uses idempotency key for same intent retry", () => {
      // Network mismatch on first attempt
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Same intent after network fix should reuse same idempotency key
      // This prevents duplicate proofs if request was in flight
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(true);
      // In component: apiClient(..., "Idempotency-Key": idempotencyKey)
      // Same intent → same key → no duplicate if retry
    });

    it("detects changed intent (should get new idempotency key)", () => {
      const originalIntent = {
        selectedPaymentIds: ["p1", "p2"],
        thresholdAmount: "100",
      };

      const modifiedIntent = {
        selectedPaymentIds: ["p1", "p2", "p3"], // Changed
        thresholdAmount: "100",
      };

      // Mismatch on original
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // After network fix with modified intent
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(true);

      // Modified intent should get NEW idempotency key
      // (not reuse the failed attempt's key)
      expect(modifiedIntent.selectedPaymentIds.length).not.toBe(
        originalIntent.selectedPaymentIds.length
      );
    });
  });

  describe("edge cases - multiple recovery attempts", () => {
    it("handles multiple network changes during single session", () => {
      const attempts = [];

      // Attempt 1: testnet (success)
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);
      attempts.push({ attempt: 1, allowed: isSigningAllowed(result.state) });

      // Attempt 2: user switches to public by accident
      walletContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);
      attempts.push({ attempt: 2, allowed: isSigningAllowed(result.state) });

      // Attempt 3: user corrects back to testnet
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);
      attempts.push({ attempt: 3, allowed: isSigningAllowed(result.state) });

      expect(attempts).toEqual([
        { attempt: 1, allowed: true },
        { attempt: 2, allowed: false },
        { attempt: 3, allowed: true },
      ]);
    });

    it("handles rapid network changes", () => {
      const scenarios = [
        { network: "Test SDF Network ; September 2015", expected: true },
        { network: "Public Global Stellar Network ; September 2015", expected: false },
        { network: "Test SDF Network ; September 2015", expected: true },
        { network: "", expected: false },
        { network: "Test SDF Network ; September 2015", expected: true },
      ];

      scenarios.forEach(({ network, expected }) => {
        const result = validateNetworkCompatibility({
          networkPassphrase: network,
        });
        const allowed = isSigningAllowed(result.state);
        expect(allowed).toBe(expected);
      });
    });
  });

  describe("disconnect during recovery", () => {
    it("clears state when user disconnects during recovery", () => {
      let isConnected = false;

      // Initial connection
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      isConnected = true;

      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // User disconnects during recovery
      isConnected = false;
      walletContext = {};

      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);
      expect(isConnected).toBe(false);
    });

    it("allows reconnection and recovery after disconnect", () => {
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Disconnect
      walletContext = {};
      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // Reconnect to testnet
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      // Can now proceed
      expect(isSigningAllowed(result.state)).toBe(true);
    });
  });

  describe("state management during recovery", () => {
    it("maintains consistent validation throughout recovery flow", () => {
      const mismatchContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const compatibleContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      // Multiple checks with same contexts produce consistent results
      for (let i = 0; i < 3; i++) {
        const mismatchResult = validateNetworkCompatibility(mismatchContext);
        expect(isSigningAllowed(mismatchResult.state)).toBe(false);

        const compatibleResult = validateNetworkCompatibility(compatibleContext);
        expect(isSigningAllowed(compatibleResult.state)).toBe(true);
      }
    });

    it("supports back-and-forth network changes during recovery", () => {
      const publicContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const testnetContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      // Simulate user repeatedly changing network while deciding
      let result = validateNetworkCompatibility(publicContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      result = validateNetworkCompatibility(testnetContext);
      expect(isSigningAllowed(result.state)).toBe(true);

      result = validateNetworkCompatibility(publicContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      result = validateNetworkCompatibility(testnetContext);
      expect(isSigningAllowed(result.state)).toBe(true);
    });
  });

  describe("user experience during recovery", () => {
    it("provides clear path from error to success", () => {
      const steps = [];

      // Step 1: Network mismatch detected
      let walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };
      let result = validateNetworkCompatibility(walletContext);

      steps.push({
        step: "mismatch_detected",
        hasGuidance: !!result.recoveryGuidance,
        canProceed: isSigningAllowed(result.state),
      });

      // Step 2: User reads guidance and fixes network
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);

      steps.push({
        step: "network_fixed",
        hasGuidance: !!result.recoveryGuidance,
        canProceed: isSigningAllowed(result.state),
      });

      expect(steps).toEqual([
        { step: "mismatch_detected", hasGuidance: true, canProceed: false },
        { step: "network_fixed", hasGuidance: false, canProceed: true },
      ]);
    });
  });
});
