/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import FAQPage from "./page";
import { faqData } from "@/lib/faq-data";

jest.mock("@/components/layout/public-shell", () => ({
  PublicShell: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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
  pageContainer: "page-container",
}));

describe("FAQPage", () => {
  it("renders the current FAQ catalogue and derived totals", () => {
    render(<FAQPage />);

    expect(
      screen.getByRole("heading", { name: "Frequently asked questions" }),
    ).toBeInTheDocument();
    expect(screen.getByText(String(faqData.length))).toBeInTheDocument();
    expect(
      screen.getByText(String(new Set(faqData.map(({ category }) => category)).size)),
    ).toBeInTheDocument();

    for (const { question } of faqData) {
      expect(screen.getAllByText(question)).toHaveLength(2);
    }
  });

  it("filters questions using their question or answer text", async () => {
    const user = userEvent.setup();
    render(<FAQPage />);

    await user.type(
      screen.getByRole("textbox", {
        name: "Search frequently asked questions",
      }),
      "non-custodial",
    );

    expect(
      screen.getAllByText("Does EarnProof store my wallet keys?"),
    ).toHaveLength(2);
    expect(
      screen.queryByText("Can verifiers see my full financial history?"),
    ).not.toBeInTheDocument();
  });

  it("shows a useful no-results state and clears the query", async () => {
    const user = userEvent.setup();
    render(<FAQPage />);
    const search = screen.getByRole("textbox", {
      name: "Search frequently asked questions",
    });

    await user.type(search, "no such earnproof topic");
    expect(
      screen.getByText(/No results found for "no such earnproof topic"/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(search).toHaveValue("");
    expect(screen.queryByText(/No results found/)).not.toBeInTheDocument();
  });

  it("exposes accordion state and answer relationships to assistive technology", async () => {
    const user = userEvent.setup();
    render(<FAQPage />);
    const firstItem = faqData[0];
    const control = screen.getByRole("button", { name: firstItem.question });
    const answer = document.getElementById(`answer-${firstItem.id}`);

    expect(answer).not.toBeNull();
    if (!answer) {
      throw new Error("The first FAQ answer region was not rendered");
    }

    expect(control).toHaveAttribute("aria-expanded", "false");
    expect(control).toHaveAttribute("aria-controls", answer.id);
    expect(answer).toHaveAttribute("aria-labelledby", control.id);
    expect(answer).not.toBeVisible();

    control.focus();
    await user.keyboard("{Enter}");

    expect(control).toHaveAttribute("aria-expanded", "true");
    expect(answer).toBeVisible();
    expect(answer).toHaveTextContent(firstItem.answer);
  });

  it("keeps capability language limited to the current testnet product", () => {
    render(<FAQPage />);

    expect(
      screen.getByText(/EarnProof currently operates on Stellar testnet/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/No mainnet date is announced/i),
    ).toBeInTheDocument();
  });
});
