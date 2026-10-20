/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { RecentAuthGate } from "../recent-auth-gate";
import type { UseRecentAuthResult } from "@/lib/auth/recent-auth";

function makeRecentAuth(overrides: Partial<UseRecentAuthResult> = {}): UseRecentAuthResult {
  return {
    isPromptOpen: true,
    status: "awaiting-signature",
    error: null,
    challenge: {
      id: "challenge-1",
      message: "sign this",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    },
    requestRecentAuth: jest.fn(),
    confirmRecentAuth: jest.fn(),
    cancelRecentAuth: jest.fn(),
    ...overrides,
  };
}

describe("RecentAuthGate", () => {
  it("renders nothing when the prompt is not open", () => {
    const { container } = render(
      <RecentAuthGate
        recentAuth={makeRecentAuth({ isPromptOpen: false })}
        actionDescription="revoke the key."
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the action description and dialog semantics", () => {
    render(
      <RecentAuthGate
        recentAuth={makeRecentAuth()}
        actionDescription='revoke the API key "CI deploys".'
      />,
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText(/revoke the API key "CI deploys"\./)).toBeInTheDocument();
  });

  it("focuses Cancel by default so a stray Enter does not authorize", () => {
    render(<RecentAuthGate recentAuth={makeRecentAuth()} actionDescription="revoke the key." />);
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
  });

  it("calls confirmRecentAuth when Continue is clicked", () => {
    const recentAuth = makeRecentAuth();
    render(<RecentAuthGate recentAuth={recentAuth} actionDescription="revoke the key." />);

    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(recentAuth.confirmRecentAuth).toHaveBeenCalledTimes(1);
  });

  it("calls cancelRecentAuth when Cancel is clicked or Escape is pressed", () => {
    const recentAuth = makeRecentAuth();
    render(<RecentAuthGate recentAuth={recentAuth} actionDescription="revoke the key." />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(recentAuth.cancelRecentAuth).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(recentAuth.cancelRecentAuth).toHaveBeenCalledTimes(2);
  });

  it("disables both buttons while verifying", () => {
    render(
      <RecentAuthGate
        recentAuth={makeRecentAuth({ status: "verifying" })}
        actionDescription="revoke the key."
      />,
    );

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Signing..." })).toBeDisabled();
  });

  it("disables Continue until a challenge has loaded", () => {
    render(
      <RecentAuthGate
        recentAuth={makeRecentAuth({ challenge: null })}
        actionDescription="revoke the key."
      />,
    );

    expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  });

  it("shows an error message when present", () => {
    render(
      <RecentAuthGate
        recentAuth={makeRecentAuth({ status: "error", error: "This confirmation expired. Please try again." })}
        actionDescription="revoke the key."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/expired/i);
  });
});
