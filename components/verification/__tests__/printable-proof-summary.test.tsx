/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { PrintableProofSummary, type PrintableProofResult } from "../printable-proof-summary";

const RESULT: PrintableProofResult = {
  status: "valid",
  credential: {
    subject: { walletHash: "sha256:7fc0123456789abcdef" },
    claim: {
      operator: "gte",
      thresholdAmount: "100",
      assetCode: "USDC",
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.000Z",
    },
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
  },
  proof: {
    id: "cred-1",
    network: "Stellar Testnet",
    revokedAt: null,
  },
};

function mockMatchMedia(matches: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({
    matches,
    media: "print",
    onchange: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    addListener: jest.fn(),
    removeListener: jest.fn(),
    dispatchEvent: jest.fn(),
  }) as unknown as typeof window.matchMedia;
}

describe("PrintableProofSummary (#148)", () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it("renders nothing outside of print mode", () => {
    mockMatchMedia(false);
    const { container } = render(<PrintableProofSummary result={RESULT} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the canonical proof identifier and verification context when printing", () => {
    mockMatchMedia(true);
    render(<PrintableProofSummary result={RESULT} />);

    expect(screen.getByText("cred-1")).toBeInTheDocument();
    expect(screen.getByText("Stellar Testnet")).toBeInTheDocument();
    expect(screen.getByText("Income gte 100 USDC")).toBeInTheDocument();
  });

  it("truncates the wallet hash instead of printing it in full", () => {
    mockMatchMedia(true);
    render(<PrintableProofSummary result={RESULT} />);

    expect(screen.getByText("sha256:7fc...")).toBeInTheDocument();
    expect(screen.queryByText("sha256:7fc0123456789abcdef")).not.toBeInTheDocument();
  });

  // The credential hash (a secret shown in full on screen by
  // VerificationPanel) has no runtime leak test here because
  // `PrintableProofResult` structurally cannot carry it: the type only
  // has the fields this component reads, so a caller cannot pass a
  // credential hash through even by accident. See the type's doc comment.

  it("shows a fallback message when the credential was not found, still while printing", () => {
    mockMatchMedia(true);
    render(<PrintableProofSummary result={{ status: "unknown" }} />);

    expect(
      screen.getByText("No matching EarnProof credential was found for this identifier."),
    ).toBeInTheDocument();
  });

  it("prints the revocation date only when the proof was revoked", () => {
    mockMatchMedia(true);
    const { rerender } = render(<PrintableProofSummary result={RESULT} />);
    expect(screen.queryByText("Revoked")).not.toBeInTheDocument();

    mockMatchMedia(true);
    rerender(
      <PrintableProofSummary
        result={{
          ...RESULT,
          proof: { ...RESULT.proof!, revokedAt: "2026-08-25T10:00:00.000Z" },
        }}
      />,
    );
    expect(screen.getByText("Revoked")).toBeInTheDocument();
  });
});
