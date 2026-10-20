/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { ProofHistoryList } from "../proof-history-list";
import type { ProofListItem } from "@/lib/api/proofs-list";

// Mock Next.js Link component
jest.mock("next/link", () => {
  return ({ children, href }: any) => <a href={href}>{children}</a>;
});

describe("ProofHistoryList", () => {
  const mockProofs: ProofListItem[] = [
    {
      id: "proof-123",
      type: "MINIMUM_INCOME",
      status: "VALID",
      issuerId: "issuer-abc",
      issuerName: "Veridatum Labs",
      createdAt: "2024-06-01T10:00:00Z",
      expiresAt: "2024-12-01T10:00:00Z",
      revokedAt: null,
      summary: {
        assetCode: "USDC",
        assetIssuer: "GBUQWP3BOUZX34ULNQG23RQ6F4BVWCISP7EXAMPLE",
      },
    },
    {
      id: "proof-456",
      type: "PAYMENT_RECEIPT",
      status: "EXPIRED",
      issuerId: "issuer-def",
      issuerName: "Partner Org",
      createdAt: "2024-03-01T10:00:00Z",
      expiresAt: "2024-03-15T10:00:00Z", // In the past
      revokedAt: null,
      summary: {
        assetCode: "USDT",
      },
    },
    {
      id: "proof-789",
      type: "RECURRING_INCOME",
      status: "VALID",
      issuerId: "issuer-ghi",
      issuerName: "Unknown Issuer",
      createdAt: "2024-05-15T14:30:00Z",
      expiresAt: "2025-05-15T14:30:00Z",
      revokedAt: "2024-06-10T08:00:00Z", // Revoked
      summary: {
        assetCode: "XLM",
      },
    },
  ];

  describe("rendering", () => {
    it("renders proof list with all items", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText("proof-123")).toBeInTheDocument();
      expect(screen.getByText("proof-456")).toBeInTheDocument();
      expect(screen.getByText("proof-789")).toBeInTheDocument();
    });

    it("renders empty when no proofs provided", () => {
      const { container } = render(<ProofHistoryList proofs={[]} />);
      expect(container.firstChild?.childNodes.length).toBe(0);
    });

    it("displays proof type correctly", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText("Minimum Income")).toBeInTheDocument();
      expect(screen.getByText("Payment Receipt")).toBeInTheDocument();
      expect(screen.getByText("Recurring Income")).toBeInTheDocument();
    });

    it("displays issuer name when available", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText("Veridatum Labs")).toBeInTheDocument();
      expect(screen.getByText("Partner Org")).toBeInTheDocument();
    });

    it("displays fallback issuer ID when name is not available", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText(/Issuer issuer-ghi/)).toBeInTheDocument();
    });

    it("displays asset code in proof summary", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText(/USDC/)).toBeInTheDocument();
      expect(screen.getByText(/USDT/)).toBeInTheDocument();
      expect(screen.getByText(/XLM/)).toBeInTheDocument();
    });
  });

  describe("status display", () => {
    it("displays status badges correctly", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getAllByText("Valid")).toHaveLength(1);
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    it("marks expired proofs with Expired status", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText("Expired")).toBeInTheDocument();
    });

    it("displays revoked indicator", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      expect(screen.getByText(/Revoked on/)).toBeInTheDocument();
    });
  });

  describe("date formatting", () => {
    it("formats dates for display", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      // Dates should be formatted as "Jun 1, 2024" style
      expect(screen.getByText(/Jun/)).toBeInTheDocument();
      expect(screen.getByText(/May/)).toBeInTheDocument();
      expect(screen.getByText(/Mar/)).toBeInTheDocument();
    });

    it("displays expiration dates", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      // "exp. Oct 15, 2025" format or similar
      expect(screen.getAllByText(/exp\./)).toHaveLength(mockProofs.length);
    });
  });

  describe("links and navigation", () => {
    it("each proof links to verification page with proof ID", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      const links = screen.getAllByRole("link");

      expect(links[0]).toHaveAttribute("href", `/proofs/verify?proof=proof-123`);
      expect(links[1]).toHaveAttribute("href", `/proofs/verify?proof=proof-456`);
      expect(links[2]).toHaveAttribute("href", `/proofs/verify?proof=proof-789`);
    });
  });

  describe("accessibility", () => {
    it("displays information in logical order for screen readers", () => {
      const { container } = render(<ProofHistoryList proofs={[mockProofs[0]]} />);

      // On mobile, content order should be: ID, Type, Issuer, Created, Status
      const text = container.textContent;

      const proofIdIndex = text?.indexOf("proof-123") ?? -1;
      const typeIndex = text?.indexOf("Minimum Income") ?? -1;
      const issuerIndex = text?.indexOf("Veridatum Labs") ?? -1;
      const statusIndex = text?.indexOf("Valid") ?? -1;

      expect(proofIdIndex).toBeGreaterThan(-1);
      expect(typeIndex).toBeGreaterThan(proofIdIndex);
      expect(statusIndex).toBeGreaterThan(-1);
    });

    it("uses semantic HTML for data display", () => {
      const { container } = render(<ProofHistoryList proofs={mockProofs} />);

      // Should use links for navigation
      expect(container.querySelectorAll("a").length).toBe(mockProofs.length);
    });
  });

  describe("responsive layout", () => {
    it("renders mobile-friendly layout structure", () => {
      const { container } = render(<ProofHistoryList proofs={mockProofs} />);

      // Mobile layout should be present (not hidden with display: none on mobile)
      const mobileContent = container.querySelector(".md\\:hidden");
      expect(mobileContent).toBeInTheDocument();
    });

    it("renders desktop table structure", () => {
      const { container } = render(<ProofHistoryList proofs={mockProofs} />);

      // Desktop layout (grid) should be present
      const desktopContent = container.querySelector(".hidden.md\\:grid");
      expect(desktopContent).toBeInTheDocument();
    });
  });

  describe("authorization and security", () => {
    it("displays only data included in ProofListItem (no extra info leakage)", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      // Should NOT display private key, signature, or other sensitive proof data
      // (only the items in ProofListItem type should be shown)
      expect(screen.queryByText(/signature/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/private/i)).not.toBeInTheDocument();
    });

    it("links only point to proof verification (public endpoint)", () => {
      render(<ProofHistoryList proofs={mockProofs} />);

      const links = screen.getAllByRole("link");
      links.forEach((link) => {
        const href = link.getAttribute("href");
        expect(href).toMatch(/\/proofs\/verify\?proof=/);
      });
    });
  });

  describe("edge cases", () => {
    it("handles proofs with missing asset issuer", () => {
      const proofWithoutIssuer: ProofListItem = {
        ...mockProofs[0],
        summary: {
          assetCode: "USDC",
          assetIssuer: null,
        },
      };

      render(<ProofHistoryList proofs={[proofWithoutIssuer]} />);

      expect(screen.getByText(/USDC/)).toBeInTheDocument();
      // Should not show "•" separator when no asset issuer
    });

    it("handles very long proof IDs", () => {
      const longIdProof: ProofListItem = {
        ...mockProofs[0],
        id: "a".repeat(100),
      };

      const { container } = render(<ProofHistoryList proofs={[longIdProof]} />);

      // Should truncate or wrap appropriately
      expect(screen.getByText("a".repeat(100))).toBeInTheDocument();
    });
  });
});
