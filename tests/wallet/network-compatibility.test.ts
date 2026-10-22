/**
 * Tests for wallet network compatibility detection and validation.
 *
 * Covers:
 * - Network detection from wallet context
 * - Compatibility determination (compatible, incompatible, unknown, unsupported)
 * - Safe display name normalization (no secret exposure)
 * - Validation gate logic for signing operations
 */

import {
  getExpectedNetworkConfig,
  detectNetworkCompatibility,
  createCompatibilityCheckResult,
  validateNetworkCompatibility,
  isSigningAllowed,
} from "@/lib/wallet/network-compatibility";
import type {
  WalletNetworkContext,
} from "@/lib/wallet/types";

describe("Wallet Network Compatibility", () => {
  describe("getExpectedNetworkConfig", () => {
    it("returns the configured Stellar network from app config", () => {
      const config = getExpectedNetworkConfig();

      expect(config).toHaveProperty("network");
      expect(config).toHaveProperty("networkPassphrase");
      expect(config.network).toBe("testnet");
      expect(config.networkPassphrase).toBe("Test SDF Network ; September 2015");
    });

    it("uses validated environment configuration as source of truth", () => {
      const config = getExpectedNetworkConfig();

      // Ensure we're using the real app config, not hardcoded defaults
      expect(config.network).not.toBe("public");
      expect(config.networkPassphrase).not.toBe(
        "Public Global Stellar Network ; September 2015"
      );
    });
  });

  describe("detectNetworkCompatibility", () => {
    const expectedConfig = getExpectedNetworkConfig();

    describe("happy path - compatible network", () => {
      it("detects compatible network when passphrase matches", () => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: "Test SDF Network ; September 2015",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("compatible");
        expect(result.detectedNetwork).toBe("Test SDF Network ; September 2015");
        expect(result.expectedNetwork).toBe("testnet");
      });

      it("detects compatible network when network name matches", () => {
        const walletContext: WalletNetworkContext = {
          network: "testnet",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("compatible");
        expect(result.detectedNetwork).toBe("testnet");
      });
    });

    describe("edge cases - missing metadata", () => {
      it("returns unknown compatibility when wallet provides no network context", () => {
        const walletContext: WalletNetworkContext = {};

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("unknown");
        expect(result.detectedNetwork).toBeUndefined();
        expect(result.reason).toContain("does not report network information");
      });

      it("returns unknown when both network fields are empty", () => {
        const walletContext: WalletNetworkContext = {
          network: "",
          networkPassphrase: "",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("unknown");
      });

      it("returns unknown when network fields are null/undefined", () => {
        const walletContext: WalletNetworkContext = {
          network: undefined,
          networkPassphrase: undefined,
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("unknown");
      });
    });

    describe("negative tests - incompatible networks", () => {
      it("detects incompatible network when connected to public", () => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("incompatible");
        expect(result.detectedNetwork).toBe(
          "Public Global Stellar Network ; September 2015"
        );
      });

      it("detects incompatible network when name doesn't match", () => {
        const walletContext: WalletNetworkContext = {
          network: "public",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.compatibility).toBe("incompatible");
        expect(result.detectedNetwork).toBe("public");
      });

      it("includes reason in incompatible result", () => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.reason).toBeDefined();
        expect(result.reason).toContain("Public");
        expect(result.reason).toContain("Testnet");
      });
    });

    describe("security - no secret exposure", () => {
      it("never returns raw passphrases in mismatch reason", () => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: "Public Global Stellar Network ; September 2015",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        expect(result.reason).not.toContain(
          "Public Global Stellar Network ; September 2015"
        );
        expect(result.reason).toContain("Public");
      });

      it("uses display names instead of raw values", () => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: "Test SDF Network ; September 2015",
        };

        const result = detectNetworkCompatibility(walletContext, expectedConfig);

        // Detection result includes raw network for comparison,
        // but createCompatibilityCheckResult converts to safe display names
        const checkResult = createCompatibilityCheckResult(result);
        expect(JSON.stringify(checkResult)).not.toContain(
          "Test SDF Network ; September 2015"
        );
      });
    });
  });

  describe("createCompatibilityCheckResult", () => {
    it("creates a valid check result for compatible networks", () => {
      const detectionResult = {
        compatibility: "compatible" as const,
        detectedNetwork: "Test SDF Network ; September 2015",
        expectedNetwork: "testnet",
      };

      const result = createCompatibilityCheckResult(detectionResult);

      expect(result.state).toBe("compatible");
      expect(result.isValid).toBe(true);
      expect(result.displayExpectedNetwork).toBe("Testnet");
      expect(result.displayDetectedNetwork).toBe("Testnet");
      expect(result.recoveryGuidance).toBeUndefined();
    });

    it("creates an invalid check result for incompatible networks", () => {
      const detectionResult = {
        compatibility: "incompatible" as const,
        detectedNetwork: "Public Global Stellar Network ; September 2015",
        expectedNetwork: "testnet",
        reason: "Mismatch detected",
      };

      const result = createCompatibilityCheckResult(detectionResult);

      expect(result.state).toBe("incompatible");
      expect(result.isValid).toBe(false);
      expect(result.displayExpectedNetwork).toBe("Testnet");
      expect(result.displayDetectedNetwork).toBe("Public");
      expect(result.recoveryGuidance).toBeDefined();
      expect(result.recoveryGuidance).toContain("Switch");
      expect(result.recoveryGuidance).toContain("Public");
      expect(result.recoveryGuidance).toContain("Testnet");
    });

    it("creates recovery guidance for unknown compatibility", () => {
      const detectionResult = {
        compatibility: "unknown" as const,
        expectedNetwork: "testnet",
        reason: "Wallet does not report network information",
      };

      const result = createCompatibilityCheckResult(detectionResult);

      expect(result.state).toBe("unknown");
      expect(result.isValid).toBe(false);
      expect(result.recoveryGuidance).toContain("does not report network");
      expect(result.recoveryGuidance).toContain("wallet");
    });

    it("creates recovery guidance for unsupported wallets", () => {
      const detectionResult = {
        compatibility: "unsupported" as const,
        expectedNetwork: "testnet",
        reason: "Wallet does not support network detection",
      };

      const result = createCompatibilityCheckResult(detectionResult);

      expect(result.state).toBe("unsupported");
      expect(result.isValid).toBe(false);
      expect(result.recoveryGuidance).toContain("does not support");
      expect(result.recoveryGuidance).toContain("Testnet");
    });

    it("never exposes secrets in recovery guidance", () => {
      const detectionResult = {
        compatibility: "incompatible" as const,
        detectedNetwork: "Public Global Stellar Network ; September 2015",
        expectedNetwork: "testnet",
      };

      const result = createCompatibilityCheckResult(detectionResult);

      expect(result.recoveryGuidance).not.toContain(
        "Public Global Stellar Network ; September 2015"
      );
      expect(result.recoveryGuidance).not.toContain(
        "Test SDF Network ; September 2015"
      );
    });
  });

  describe("validateNetworkCompatibility", () => {
    it("validates compatible wallet network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("compatible");
      expect(result.isValid).toBe(true);
    });

    it("validates incompatible wallet network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("incompatible");
      expect(result.isValid).toBe(false);
    });

    it("validates unknown wallet network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);

      expect(result.state).toBe("unknown");
      expect(result.isValid).toBe(false);
    });

    it("returns a complete check result with all required fields", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result).toHaveProperty("state");
      expect(result).toHaveProperty("isValid");
      expect(result).toHaveProperty("displayExpectedNetwork");
      expect(result).toHaveProperty("displayDetectedNetwork");
      expect(result).toHaveProperty("recoveryGuidance");
    });
  });

  describe("isSigningAllowed", () => {
    it("allows signing when compatibility is compatible", () => {
      expect(isSigningAllowed("compatible")).toBe(true);
    });

    it("blocks signing when compatibility is incompatible", () => {
      expect(isSigningAllowed("incompatible")).toBe(false);
    });

    it("blocks signing when compatibility is unknown", () => {
      expect(isSigningAllowed("unknown")).toBe(false);
    });

    it("blocks signing when compatibility is unsupported", () => {
      expect(isSigningAllowed("unsupported")).toBe(false);
    });

    it("only allows signing for the compatible state", () => {
      const states = [
        "compatible",
        "incompatible",
        "unknown",
        "unsupported",
      ] as const;
      const allowed = states.filter((state) => isSigningAllowed(state));

      expect(allowed).toEqual(["compatible"]);
    });
  });

  describe("integration - end-to-end validation flow", () => {
    it("detects, validates, and gates signing for compatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(result.isValid).toBe(true);
      expect(canSign).toBe(true);
      expect(result.recoveryGuidance).toBeUndefined();
    });

    it("detects, validates, and gates signing for incompatible network", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Public Global Stellar Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(result.isValid).toBe(false);
      expect(canSign).toBe(false);
      expect(result.recoveryGuidance).toBeDefined();
      expect(result.displayDetectedNetwork).toBe("Public");
      expect(result.displayExpectedNetwork).toBe("Testnet");
    });

    it("detects, validates, and gates signing for unknown network", () => {
      const walletContext: WalletNetworkContext = {};

      const result = validateNetworkCompatibility(walletContext);
      const canSign = isSigningAllowed(result.state);

      expect(result.isValid).toBe(false);
      expect(canSign).toBe(false);
      expect(result.recoveryGuidance).toBeDefined();
    });

    it("prevents signing in all non-compatible states", () => {
      const invalidStates = ["incompatible", "unknown", "unsupported"] as const;

      invalidStates.forEach((state) => {
        const canSign = isSigningAllowed(state);
        expect(canSign).toBe(false);
      });
    });
  });

  describe("display name normalization", () => {
    it("normalizes known testnet networks to 'Testnet'", () => {
      const testnetPassphrases = [
        "Test SDF Network ; September 2015",
        "testnet",
      ];

      testnetPassphrases.forEach((passphrase) => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: passphrase,
        };

        const result = validateNetworkCompatibility(walletContext);

        expect(result.displayExpectedNetwork).toBe("Testnet");
        if (walletContext.networkPassphrase === passphrase) {
          expect(result.displayDetectedNetwork).toBe("Testnet");
        }
      });
    });

    it("normalizes known public networks to 'Public'", () => {
      const publicPassphrases = [
        "Public Global Stellar Network ; September 2015",
        "public",
      ];

      publicPassphrases.forEach((passphrase) => {
        const walletContext: WalletNetworkContext = {
          networkPassphrase: passphrase,
        };

        const result = validateNetworkCompatibility(walletContext);

        if (walletContext.networkPassphrase === passphrase) {
          expect(result.displayDetectedNetwork).toBe("Public");
        }
      });
    });

    it("normalizes unknown networks to 'Unrecognized Network'", () => {
      const unknownPassphrase = "Custom Network ; Unknown";
      const walletContext: WalletNetworkContext = {
        networkPassphrase: unknownPassphrase,
      };

      const result = validateNetworkCompatibility(walletContext);

      if (walletContext.networkPassphrase === unknownPassphrase) {
        expect(result.displayDetectedNetwork).toBe("Unrecognized Network");
      }
    });

    it("treats undefined and null as unknown", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: undefined,
        network: null as unknown as string | undefined,
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.displayDetectedNetwork).toBeUndefined();
      expect(result.state).toBe("unknown");
    });

    it("never displays raw passphrases in normalized names", () => {
      const walletContext: WalletNetworkContext = {
        networkPassphrase: "Test SDF Network ; September 2015",
      };

      const result = validateNetworkCompatibility(walletContext);

      expect(result.displayExpectedNetwork).not.toContain(";");
      expect(result.displayExpectedNetwork).not.toContain("SDF");
      expect(result.displayDetectedNetwork).not.toContain(";");
    });
  });
});
