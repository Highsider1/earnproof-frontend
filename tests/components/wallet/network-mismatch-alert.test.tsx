/**
 * Tests for NetworkMismatchAlert component.
 *
 * Covers:
 * - Conditional rendering based on compatibility state
 * - Accessibility (role=alert, aria-live, focus management)
 * - Display of network names without exposing secrets
 * - Recovery guidance clarity
 */

import { render, screen } from "@testing-library/react";
import { NetworkMismatchAlert } from "@/components/wallet/network-mismatch-alert";
import type { NetworkCompatibilityCheckResult } from "@/lib/wallet/types";

describe("NetworkMismatchAlert", () => {
  describe("rendering behavior", () => {
    it("does not render when compatibility is valid", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "compatible",
        isValid: true,
        displayExpectedNetwork: "Testnet",
      };

      const { container } = render(<NetworkMismatchAlert result={result} />);

      expect(container.firstChild).toBeNull();
    });

    it("renders alert when network is incompatible", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance:
          "Your wallet is connected to Public. Switch it to Testnet and try again.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(screen.getByText("Wrong Network")).toBeInTheDocument();
      expect(
        screen.getByText(/Your wallet is connected to Public/)
      ).toBeInTheDocument();
    });

    it("renders alert when network is unknown", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unknown",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance:
          "Your wallet does not report network information. Ensure you are using a recent version of your wallet and try again.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(screen.getByText("Network Not Detected")).toBeInTheDocument();
      expect(
        screen.getByText(/does not report network information/)
      ).toBeInTheDocument();
    });

    it("renders alert when wallet is unsupported", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unsupported",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance:
          "Your wallet does not support network detection. Verify manually that it is connected to Testnet.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(screen.getByText("Unsupported Wallet")).toBeInTheDocument();
      expect(
        screen.getByText(/does not support network detection/)
      ).toBeInTheDocument();
    });
  });

  describe("accessibility", () => {
    const incompatibleResult: NetworkCompatibilityCheckResult = {
      state: "incompatible",
      isValid: false,
      displayExpectedNetwork: "Testnet",
      displayDetectedNetwork: "Public",
      recoveryGuidance:
        "Your wallet is connected to Public. Switch it to Testnet and try again.",
    };

    it("has role=alert for assertive announcement", () => {
      const { container } = render(
        <NetworkMismatchAlert result={incompatibleResult} />
      );

      const alert = container.querySelector('[role="alert"]');
      expect(alert).toBeInTheDocument();
    });

    it("has aria-live=assertive for screen reader announcement", () => {
      const { container } = render(
        <NetworkMismatchAlert result={incompatibleResult} />
      );

      const alert = container.querySelector('[aria-live="assertive"]');
      expect(alert).toBeInTheDocument();
    });

    it("supports focus management via forwardRef", () => {
      const ref = { current: null as HTMLDivElement | null };

      render(<NetworkMismatchAlert result={incompatibleResult} forwardRef={ref} />);

      expect(ref.current).toBeInTheDocument();
      expect(ref.current?.getAttribute("role")).toBe("alert");
    });

    it("displays semantic heading for alert title", () => {
      render(<NetworkMismatchAlert result={incompatibleResult} />);

      const heading = screen.getByText("Wrong Network");
      expect(heading.tagName).toBe("H3");
    });

    it("displays recovery guidance as descriptive text", () => {
      render(<NetworkMismatchAlert result={incompatibleResult} />);

      const guidance = screen.getByText(/Switch it to Testnet/);
      expect(guidance).toBeInTheDocument();
      expect(guidance.tagName).toBe("P");
    });
  });

  describe("display of network information", () => {
    it("displays detected network when available", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance: "Switch network",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(screen.getByText("Connected to:")).toBeInTheDocument();
      expect(screen.getByText("Public")).toBeInTheDocument();
    });

    it("displays expected network", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance: "Switch network",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(screen.getByText("Expected:")).toBeInTheDocument();
      expect(screen.getByText("Testnet")).toBeInTheDocument();
    });

    it("does not display detected network info when not available", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unknown",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "Wallet does not report network",
      };

      const { container } = render(
        <NetworkMismatchAlert result={result} forwardRef={{ current: null }} />
      );

      const networkInfo = container.querySelector("div.space-y-1");
      expect(networkInfo).not.toBeInTheDocument();
    });
  });

  describe("recovery guidance", () => {
    it("displays incompatible recovery guidance", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance:
          "Your wallet is connected to Public. Switch it to Testnet and try again.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(
        screen.getByText(/Your wallet is connected to Public/)
      ).toBeInTheDocument();
    });

    it("displays unknown network recovery guidance", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unknown",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance:
          "Your wallet does not report network information. Ensure you are using a recent version of your wallet and try again.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(
        screen.getByText(/does not report network information/)
      ).toBeInTheDocument();
    });

    it("displays unsupported wallet recovery guidance", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unsupported",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance:
          "Your wallet does not support network detection. Verify manually that it is connected to Testnet.",
      };

      render(<NetworkMismatchAlert result={result} />);

      expect(
        screen.getByText(/does not support network detection/)
      ).toBeInTheDocument();
    });
  });

  describe("styling and visual hierarchy", () => {
    it("uses alert styling (amber border and background)", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "Switch network",
      };

      const { container } = render(
        <NetworkMismatchAlert result={result} forwardRef={{ current: null }} />
      );

      const alert = container.firstChild as HTMLElement;
      expect(alert.className).toContain("bg-amber-300/10");
      expect(alert.className).toContain("border-amber-300/50");
    });

    it("displays title in amber text", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "Switch network",
      };

      const { container } = render(
        <NetworkMismatchAlert result={result} forwardRef={{ current: null }} />
      );

      const title = container.querySelector("h3");
      expect(title?.className).toContain("text-amber-100");
    });
  });

  describe("security - no secret exposure", () => {
    it("never displays raw network passphrases", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance:
          "Your wallet is connected to Public. Switch it to Testnet and try again.",
      };

      const { container } = render(
        <NetworkMismatchAlert result={result} forwardRef={{ current: null }} />
      );

      const text = container.textContent || "";
      expect(text).not.toContain("Test SDF Network ; September 2015");
      expect(text).not.toContain(
        "Public Global Stellar Network ; September 2015"
      );
    });

    it("only displays safe, normalized network names", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        displayDetectedNetwork: "Public",
        recoveryGuidance: "Switch network",
      };

      const { container } = render(
        <NetworkMismatchAlert result={result} forwardRef={{ current: null }} />
      );

      const text = container.textContent || "";
      expect(text).toContain("Testnet");
      expect(text).toContain("Public");
      expect(text).not.toContain(";");
    });
  });

  describe("title selection", () => {
    it("shows 'Wrong Network' for incompatible state", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "incompatible",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "text",
      };

      render(<NetworkMismatchAlert result={result} />);
      expect(screen.getByText("Wrong Network")).toBeInTheDocument();
    });

    it("shows 'Network Not Detected' for unknown state", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unknown",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "text",
      };

      render(<NetworkMismatchAlert result={result} />);
      expect(screen.getByText("Network Not Detected")).toBeInTheDocument();
    });

    it("shows 'Unsupported Wallet' for unsupported state", () => {
      const result: NetworkCompatibilityCheckResult = {
        state: "unsupported",
        isValid: false,
        displayExpectedNetwork: "Testnet",
        recoveryGuidance: "text",
      };

      render(<NetworkMismatchAlert result={result} />);
      expect(screen.getByText("Unsupported Wallet")).toBeInTheDocument();
    });
  });
});
