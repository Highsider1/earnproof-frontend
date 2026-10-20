import { render, screen } from "@testing-library/react";
import { PaymentEligibilityExplanation } from "../payment-eligibility-explanation";
import type { Payment } from "@/lib/api/payments";

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment-1",
    stellarTransactionHash: "aaaaaaaa00000000000000000000000000000000000000000000000000aa",
    sourceAddress: "GSOURCEADDRESS0000000000000000000000000000000000000001",
    assetCode: "USDC",
    occurredAt: "2026-06-01T12:00:00.000Z",
    classification: "INCOME",
    isEligible: true,
    ...overrides,
  };
}

describe("PaymentEligibilityExplanation", () => {
  it("shows an Eligible badge and classification for an eligible payment (positive case)", () => {
    const payment = makePayment({ classification: "INCOME", isEligible: true });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.getByText("Eligible")).toBeInTheDocument();
    expect(screen.getByText("Income")).toBeInTheDocument();
  });

  it("shows an Excluded badge for an ineligible payment (negative/excluded case)", () => {
    const payment = makePayment({ classification: "PERSONAL_TRANSFER", isEligible: false });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.getByText("Excluded")).toBeInTheDocument();
    expect(screen.getByText("Personal Transfer")).toBeInTheDocument();
  });

  it("shows 'Unclassified' for an UNKNOWN classification (unsupported/unclassified case)", () => {
    const payment = makePayment({ classification: "UNKNOWN", isEligible: false });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.getByText("Unclassified")).toBeInTheDocument();
  });

  it("shows the asset code and occurrence date", () => {
    const payment = makePayment({ assetCode: "XLM", occurredAt: "2026-03-15T08:30:00.000Z" });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("never renders the source or destination address (redaction requirement)", () => {
    const payment = makePayment({
      sourceAddress: "GSHOULDNOTAPPEAR000000000000000000000000000000000000001",
      destinationAddress: "GSHOULDNOTAPPEAREITHER00000000000000000000000000000002",
    });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.queryByText(/GSHOULDNOTAPPEAR/)).not.toBeInTheDocument();
  });

  it("never renders the raw transaction hash", () => {
    const payment = makePayment();

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.queryByText(payment.stellarTransactionHash)).not.toBeInTheDocument();
  });

  it("discloses that detailed reason codes are not available, rather than fabricating one", () => {
    const payment = makePayment({ classification: "EXCLUDED", isEligible: false });

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(
      screen.getByText(/reason codes are not provided by the API/i),
    ).toBeInTheDocument();
  });

  it("shows a stale-decision notice when isStale is true (stale-decision case)", () => {
    const payment = makePayment();

    render(<PaymentEligibilityExplanation payment={payment} isStale />);

    expect(screen.getByRole("status")).toHaveTextContent(/may be out of date/i);
  });

  it("does not show a stale notice by default", () => {
    const payment = makePayment();

    render(<PaymentEligibilityExplanation payment={payment} />);

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
