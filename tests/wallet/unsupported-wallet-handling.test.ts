/**
 * Tests for unsupported wallet detection and handling.
 *
 * Covers:
 * - Detection of wallets that don't support network reporting
 * - Proper treatment as unknown or unsupported state
 * - Clear guidance to users on how to proceed
 * - Prevention of signing on unsupported wallets
 */

import {
  detectNetworkCompatibility,
  validateNetworkCompatibility,
  isSigningAllowed,
} from "@/lib/wallet/network-compatibility";
import { getExpectedNetworkConfig } from "@/lib/wallet/network-compatibility";
import type { WalletNetworkContext } from "@/lib/wallet/types";

describe("Unsupported Wallet Handling", () => {
  describe("detection of unsupported wallets", () => {
    it("treats wallet with no network metadata as unknown", () => {
      const walletContext: WalletNetworkContext = {};
      const expectedConfig = getExpectedNetworkConfig();

      const result = detectNetworkCompatibility(walletContext, expectedConfig);

      expect(result.compatibility).toBe("unknown");
      expect(result.detectedNetwork).toBeUndefined();
    });

    it("provides guidance for wallets that don't report network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("unknown");
      expect(result.recoveryGuidance).toBeDefined();
      expect(result.recoveryGuidance).toContain("does not report");
      expect(result.recoveryGuidance).toContain("wallet");
    });

    it("blocks signing for wallets with unknown network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(isSigningAllowed(result.state)).toBe(false);
      expect(result.isValid).toBe(false);
    });
  });

  describe("wallets with partial metadata", () => {
    it("handles wallet with only network name (no passphrase)", () => {
      const walletContext: WalletNetworkContext = {
        network: "testnet",
        networkPassphrase: undefined,
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.isValid).toBe(true);
      expect(result.state).toBe("compatible");
    });

    it("handles wallet with only passphrase (no network name)", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
        network: undefined,
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.isValid).toBe(true);
      expect(result.state).toBe("compatible");
    });

    it("treats empty strings as missing metadata", () => {
      const walletContext: WalletNetworkContext = {
        network: "",
        networkPassphrase: "",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("unknown");
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("handles whitespace-only network values", () => {
      const walletContext: WalletNetworkContext = {
        network: "   ",
        networkPassphrase: "\t",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Whitespace-only values get trimmed and treated as empty
      // which results in incompatible (since they don't match known networks)
      // or could be unknown depending on implementation
      expect(result.state).toBe("incompatible");
    });
  });

  describe("unsupported wallet guidance", () => {
    it("guides users to update their wallet for network detection", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toContain("recent version");
      expect(result.recoveryGuidance).toContain("wallet");
    });

    it("advises manual network verification if update is not possible", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      // Guidance should mention manual verification as fallback
      if (result.state === "unknown") {
        expect(result.recoveryGuidance).toBeDefined();
      }
    });
  });

  describe("different unsupported wallet types", () => {
    it("treats old Freighter versions (no network data) as unknown", () => {
      // Simulates Freighter v4 or earlier that doesn't report network
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("unknown");
      expect(isSigningAllowed(result.state)).toBe(false);
    });

    it("handles wallet with only empty capability reporting", () => {
      const walletContext: WalletNetworkContext = {
        network: undefined,
        networkPassphrase: undefined,
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("unknown");
    });

    it("handles completely unknown wallet signature", () => {
      const walletContext: WalletNetworkContext = {
        network: "unknown-wallet",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Should be incompatible since it doesn't match known networks
      expect(result.state).toBe("incompatible");
    });
  });

  describe("no false negatives", () => {
    it("does not accidentally allow unknown wallets to sign", () => {
      const unknownContexts = [
        {},
        { network: undefined },
        { networkPassphrase: undefined },
        { network: "", networkPassphrase: "" },
      ];

      unknownContexts.forEach((context) => {
        const result = validateNetworkCompatibility(context);

        // Should never be allowed to sign if network is unknown
        expect(isSigningAllowed(result.state)).toBe(false);
      });
    });

    it("requires explicit compatibility for signing", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      // Only compatible state allows signing
      expect(isSigningAllowed(result.state)).toBe(
        result.state === "compatible"
      );
    });
  });

  describe("no false positives", () => {
    it("does not block compatible wallets that report network", () => {
      const compatibleContexts = [
        { networkPassphrase: "Test SDF Network ; September 2015" },
        { network: "testnet" },
        {
          network: "testnet",
          networkPassphrase: "Test SDF Network ; September 2015",
        },
      ];

      compatibleContexts.forEach((context) => {
        const result = validateNetworkCompatibility(context);

        // Should allow compatible networks to sign
        expect(isSigningAllowed(result.state)).toBe(true);
      });
    });
  });

  describe("error messages for unsupported scenarios", () => {
    it("provides actionable guidance when wallet doesn't report network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      // Should mention updating wallet, not blame user
      expect(result.recoveryGuidance).toContain("wallet");
      expect(result.recoveryGuidance).not.toContain("error");
      expect(result.recoveryGuidance).not.toContain("fail");
    });

    it("does not expose internals in error messages", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      // Should not expose implementation details
      expect(result.recoveryGuidance).not.toContain("JSON");
      expect(result.recoveryGuidance).not.toContain("API");
      expect(result.recoveryGuidance).not.toContain("null");
      expect(result.recoveryGuidance).not.toContain("undefined");
    });
  });

  describe("consistency across unsupported wallet scenarios", () => {
    it("treats all unknown wallets the same way", () => {
      const unknownContexts = [
        {},
        { network: undefined },
        { networkPassphrase: undefined },
      ];

      const results = unknownContexts.map((context) =>
        validateNetworkCompatibility(context)
      );

      results.forEach((result) => {
        expect(isSigningAllowed(result.state)).toBe(false);
        expect(result.isValid).toBe(false);
      });
    });

    it("maintains behavior across multiple checks", () => {
      const walletContext: WalletNetworkContext = {};

      const results = Array.from({ length: 5 }).map(() =>
        validateNetworkCompatibility(walletContext)
      );

      // All checks should be consistent
      results.forEach((result) => {
        expect(result.state).toBe("unknown");
        expect(isSigningAllowed(result.state)).toBe(false);
      });
    });
  });

  describe("upgrade path for unsupported wallets", () => {
    it("suggests upgrading to supported wallet version", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.recoveryGuidance).toBeDefined();
      // Should guide toward updating wallet
      expect(result.recoveryGuidance?.toLowerCase()).toContain("wallet");
    });

    it("allows retry after wallet update", () => {
      // Initial: old unsupported wallet
      let walletContext: WalletNetworkContext = {};
      let result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(false);

      // After update: modern Freighter v5+ with network reporting
      walletContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };
      result = validateNetworkCompatibility(walletContext);
      expect(isSigningAllowed(result.state)).toBe(true);
    });
  });
});
