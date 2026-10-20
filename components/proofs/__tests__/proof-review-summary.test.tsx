/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { ProofReviewSummary } from "../proof-review-summary";
import type { MinimumIncomeProofPayload } from "@/lib/proofs/minimum-income-payload";

const payload: MinimumIncomeProofPayload = {
  selectedPaymentIds: ["pay_1", "pay_2"],
  thresholdAmount: "100",
  assetCode: "USDC",
  assetIssuer: "GISSUER1",
  periodStart: "2026-08-01T00:00:00.000Z",
  periodEnd: "2026-08-31T23:59:59.000Z",
  expiresInDays: 30,
};

describe("ProofReviewSummary", () => {
  it("renders the committed payload fields exactly as given", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("100 USDC")).toBeInTheDocument();
    expect(screen.getByText("2026-08-01T00:00:00.000Z")).toBeInTheDocument();
    expect(screen.getByText("2026-08-31T23:59:59.000Z")).toBeInTheDocument();
    expect(screen.getByText("30 days")).toBeInTheDocument();
  });

  it("shows the derived qualifying payment count separately from committed fields", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByText("Derived (not sent — computed by the server)")).toBeInTheDocument();
  });

  it("shows the confirm button when not yet confirmed", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "I have reviewed this and confirm" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create proof" })).not.toBeInTheDocument();
  });

  it("shows the submit button once confirmed", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "Create proof" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "I have reviewed this and confirm" }),
    ).not.toBeInTheDocument();
  });

  it("calls onConfirm when the confirm button is clicked", () => {
    const onConfirm = jest.fn();
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "I have reviewed this and confirm" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when Back to edit is clicked", () => {
    const onCancel = jest.fn();
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Back to edit" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("shows a submitting label and disables actions while submitting", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
        isSubmitting
      />
    );

    expect(screen.getByRole("button", { name: "Creating proof..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Back to edit" })).toBeDisabled();
  });

  it("confirm button uses type=button so it never submits the form itself", () => {
    render(
      <ProofReviewSummary
        payload={payload}
        qualifyingPaymentCount={2}
        isConfirmed={false}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />
    );

    expect(
      screen.getByRole("button", { name: "I have reviewed this and confirm" }),
    ).toHaveAttribute("type", "button");
  });
});
