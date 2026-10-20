/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { CoverageReviewStep, type PeriodCoverageEntry } from "../coverage-review-step";

const PERIODS: PeriodCoverageEntry[] = [
  { start: "2026-01-01T00:00:00.000Z", end: "2026-02-01T00:00:00.000Z", covered: true, qualifyingPaymentCount: 2 },
  { start: "2026-02-01T00:00:00.000Z", end: "2026-03-01T00:00:00.000Z", covered: false, qualifyingPaymentCount: 0 },
];

describe("CoverageReviewStep", () => {
  it("shows how many periods are covered out of the total", () => {
    render(
      <CoverageReviewStep
        periods={PERIODS}
        gapPolicy="SHORT_GAPS"
        assetCode="USDC"
        assetIssuer=""
        onAssetCodeChange={jest.fn()}
        onAssetIssuerChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/1 of 2 periods covered/i)).toBeInTheDocument();
  });

  it("labels each period as Covered or Missing", () => {
    render(
      <CoverageReviewStep
        periods={PERIODS}
        gapPolicy="SHORT_GAPS"
        assetCode="USDC"
        assetIssuer=""
        onAssetCodeChange={jest.fn()}
        onAssetIssuerChange={jest.fn()}
      />,
    );

    expect(screen.getByText("Covered")).toBeInTheDocument();
    expect(screen.getByText("Missing")).toBeInTheDocument();
  });

  it("never renders a qualifying payment count value directly to preserve privacy", () => {
    render(
      <CoverageReviewStep
        periods={PERIODS}
        gapPolicy="SHORT_GAPS"
        assetCode="USDC"
        assetIssuer=""
        onAssetCodeChange={jest.fn()}
        onAssetIssuerChange={jest.fn()}
      />,
    );

    expect(screen.queryByText("2")).not.toBeInTheDocument();
  });

  it("shows a prompt when there are no periods yet", () => {
    render(
      <CoverageReviewStep
        periods={[]}
        gapPolicy="SHORT_GAPS"
        assetCode=""
        assetIssuer=""
        onAssetCodeChange={jest.fn()}
        onAssetIssuerChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/Set period boundaries/i)).toBeInTheDocument();
  });

  it("mentions the gap policy's tolerated gap when above zero", () => {
    render(
      <CoverageReviewStep
        periods={PERIODS}
        gapPolicy="EXTENDED_GAPS"
        assetCode="USDC"
        assetIssuer=""
        onAssetCodeChange={jest.fn()}
        onAssetIssuerChange={jest.fn()}
      />,
    );

    expect(screen.getByText(/up to 45 days/i)).toBeInTheDocument();
  });
});
