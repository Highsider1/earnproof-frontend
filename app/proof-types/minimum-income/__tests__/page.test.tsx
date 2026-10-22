import { render, screen } from "@testing-library/react";
import MinimumIncomeProofTypePage from "../page";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  usePathname: () => "/proof-types/minimum-income"
}));

// Mock Next.js Link component
jest.mock("next/link", () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

describe("MinimumIncomeProofTypePage", () => {
  it("renders the page heading and availability badge", () => {
    render(<MinimumIncomeProofTypePage />);

    expect(screen.getByRole("heading", { name: "Minimum Income", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
  });

  it("shows the disclosed proof details", () => {
    render(<MinimumIncomeProofTypePage />);

    for (const label of ["Threshold", "Asset", "Period", "Payment count", "Wallet hash", "Issued date", "Expiry date", "Status"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it("states that sensitive details remain hidden", () => {
    render(<MinimumIncomeProofTypePage />);

    for (const field of [
      "Exact total income earned",
      "Individual source transactions",
      "Sender addresses",
      "Wallet balance",
    ]) {
      expect(screen.getByText(field)).toBeInTheDocument();
    }
  });

  it("links the primary action to the create proof flow", () => {
    render(<MinimumIncomeProofTypePage />);

    const createLink = screen.getByText("Create a minimum income proof").closest("a");
    expect(createLink).toHaveAttribute("href", "/proofs");
  });

  it("links back to all proof types", () => {
    render(<MinimumIncomeProofTypePage />);

    const browseLink = screen.getByText("Browse all proof types").closest("a");
    expect(browseLink).toHaveAttribute("href", "/proof-types");
  });
});
