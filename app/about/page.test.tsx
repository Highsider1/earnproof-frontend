import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactNode } from "react";
import AboutPage from "./page";

jest.mock("@/components/layout/public-shell", () => ({
  PublicShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/common/page-heading", () => ({
  PageHeading: ({
    title,
    description,
  }: {
    title: string;
    description: string;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

jest.mock("@/components/common/production-ui", () => ({
  pageContainer: "mocked-container",
  StatusBadge: ({ children }: { children: ReactNode }) => (
    <span>{children}</span>
  ),
}));

describe("AboutPage", () => {
  it("renders the current page heading and hero", () => {
    render(<AboutPage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "About EarnProof" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "About EarnProof" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(
      "Open infrastructure for portable, privacy-preserving financial evidence.",
    )).toHaveLength(2);
    expect(screen.getByText("Open protocol")).toBeInTheDocument();
  });

  it("renders the three current feature cards", () => {
    render(<AboutPage />);

    for (const title of ["Open source", "Non-custodial", "Built on Stellar"]) {
      expect(screen.getByRole("heading", { level: 3, name: title })).toBeInTheDocument();
    }
    expect(screen.getByText(/transparent and auditable policy/i)).toBeInTheDocument();
    expect(screen.getByText(/wallet keys remain with their owners/i)).toBeInTheDocument();
    expect(screen.getByText(/independently verifiable evidence/i)).toBeInTheDocument();
  });

  it("links to the protocol explanation", () => {
    render(<AboutPage />);

    expect(screen.getByRole("link", { name: "Explore the protocol" })).toHaveAttribute(
      "href",
      "/how-it-works",
    );
  });

  it("uses the expected semantic structure", () => {
    const { container } = render(<AboutPage />);

    expect(container.querySelectorAll("main")).toHaveLength(1);
    expect(container.querySelectorAll("section")).toHaveLength(2);
    expect(container.querySelectorAll("article")).toHaveLength(3);
    expect(container.querySelector("main")).toHaveClass("mocked-container");
  });

  it("does not introduce external links", () => {
    render(<AboutPage />);

    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).toMatch(/^\//);
    }
  });
});
