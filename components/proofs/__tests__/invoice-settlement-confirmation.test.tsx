/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceSettlementConfirmation } from "../invoice-settlement-confirmation";

describe("InvoiceSettlementConfirmation", () => {
  const baseProps = {
    normalizedInvoiceReference: "INV-2026-001",
    assetCode: "USDC",
    occurredAt: "2026-01-15T00:00:00.000Z",
    expiresInDays: 90,
    onExpiresInDaysChange: jest.fn(),
    onCreateProof: jest.fn(),
    loading: false,
    canSubmit: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the reference, asset, and settlement date", () => {
    render(<InvoiceSettlementConfirmation {...baseProps} />);

    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
  });

  it("calls onCreateProof when clicked", () => {
    render(<InvoiceSettlementConfirmation {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Proof/i }));
    expect(baseProps.onCreateProof).toHaveBeenCalled();
  });

  it("disables the button when canSubmit is false", () => {
    render(<InvoiceSettlementConfirmation {...baseProps} canSubmit={false} />);

    expect(screen.getByRole("button", { name: /Create Proof/i })).toBeDisabled();
  });

  it("shows a loading state while submitting", () => {
    render(<InvoiceSettlementConfirmation {...baseProps} loading={true} />);

    expect(screen.getByRole("button", { name: /Creating proof/i })).toBeDisabled();
  });

  it("calls onExpiresInDaysChange when the input changes", () => {
    render(<InvoiceSettlementConfirmation {...baseProps} />);

    fireEvent.change(screen.getByLabelText(/Expires in/i), { target: { value: "45" } });
    expect(baseProps.onExpiresInDaysChange).toHaveBeenCalledWith(45);
  });
});
