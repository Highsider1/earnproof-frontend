/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { WalletConsentScreen } from "../wallet-consent-screen";

const challenge = {
  origin: "https://app.earnproof.test",
  network: "testnet",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  purpose: "Sign in to EarnProof",
};

describe("WalletConsentScreen", () => {
  it("renders the challenge origin, network, and purpose", () => {
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(challenge.origin)).toBeInTheDocument();
    expect(screen.getByText(challenge.purpose)).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
  });

  it("has correct dialog accessibility attributes", () => {
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
  });

  it("focuses Cancel by default so a stray Enter does not authorize", () => {
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("calls onContinue when Continue is clicked", () => {
    const onContinue = jest.fn();
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={onContinue}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel on Escape", () => {
    const onCancel = jest.fn();
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables both buttons while processing", () => {
    render(
      <WalletConsentScreen
        challenge={challenge}
        onContinue={jest.fn()}
        onCancel={jest.fn()}
        isProcessing
      />
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Signing..." })).toBeDisabled();
  });
});
