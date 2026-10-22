/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { SettlementMatchStep, type SettlementCandidate } from "../settlement-match-step";

const CANDIDATE: SettlementCandidate = {
  paymentId: "pay-1",
  assetCode: "USDC",
  occurredAt: "2026-01-15T00:00:00.000Z",
  isSupportedAsset: true,
  alreadyBoundElsewhere: false,
};

describe("SettlementMatchStep", () => {
  it("shows a matched message and selects the payment when there is exactly one candidate", () => {
    render(
      <SettlementMatchStep
        candidates={[CANDIDATE]}
        selectedPaymentId="pay-1"
        matchOutcome={{ kind: "MATCHED", paymentId: "pay-1" }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByText(/single matching settlement/i)).toBeInTheDocument();
    expect(screen.getByRole("radio")).toBeChecked();
  });

  it("shows an ambiguous message with the candidate count", () => {
    render(
      <SettlementMatchStep
        candidates={[CANDIDATE, { ...CANDIDATE, paymentId: "pay-2" }]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "AMBIGUOUS", candidateCount: 2 }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByText(/2 payments could match/i)).toBeInTheDocument();
  });

  it("shows an unsupported-asset message", () => {
    render(
      <SettlementMatchStep
        candidates={[{ ...CANDIDATE, isSupportedAsset: false, assetCode: "SHIB" }]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "UNSUPPORTED_ASSET", assetCode: "SHIB" }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByText(/not a supported settlement asset/i)).toBeInTheDocument();
  });

  it("shows a no-match message when there are no candidates", () => {
    render(
      <SettlementMatchStep
        candidates={[]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "NO_MATCH" }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByText(/No eligible payments/i)).toBeInTheDocument();
  });

  it("shows an already-bound message", () => {
    render(
      <SettlementMatchStep
        candidates={[{ ...CANDIDATE, alreadyBoundElsewhere: true }]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "ALREADY_BOUND_ELSEWHERE" }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByText(/already bound to a different invoice/i)).toBeInTheDocument();
  });

  it("disables radios for unsupported or already-bound candidates", () => {
    render(
      <SettlementMatchStep
        candidates={[{ ...CANDIDATE, alreadyBoundElsewhere: true }]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "ALREADY_BOUND_ELSEWHERE" }}
        onSelectPayment={jest.fn()}
      />,
    );

    expect(screen.getByRole("radio")).toBeDisabled();
  });

  it("calls onSelectPayment when a candidate is chosen", () => {
    const onSelectPayment = jest.fn();
    render(
      <SettlementMatchStep
        candidates={[CANDIDATE, { ...CANDIDATE, paymentId: "pay-2" }]}
        selectedPaymentId={null}
        matchOutcome={{ kind: "AMBIGUOUS", candidateCount: 2 }}
        onSelectPayment={onSelectPayment}
      />,
    );

    fireEvent.click(screen.getAllByRole("radio")[0]);
    expect(onSelectPayment).toHaveBeenCalledWith("pay-1");
  });
});
