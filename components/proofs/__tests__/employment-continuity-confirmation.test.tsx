/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { EmploymentContinuityConfirmation } from "../employment-continuity-confirmation";

describe("EmploymentContinuityConfirmation", () => {
  const baseProps = {
    continuityLengthMonths: 3,
    gapPolicy: "SHORT_GAPS" as const,
    periodStart: "2026-01-01",
    periodEnd: "2026-04-01",
    assetCode: "USDC",
    totalPeriods: 3,
    coveredPeriods: 3,
    expiresInDays: 90,
    onExpiresInDaysChange: jest.fn(),
    onCreateProof: jest.fn(),
    loading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the configured summary values", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} />);

    expect(screen.getByText("3 months")).toBeInTheDocument();
    expect(screen.getByText("Short gaps tolerated")).toBeInTheDocument();
    expect(screen.getByText("USDC")).toBeInTheDocument();
    expect(screen.getByText("3 of 3 periods")).toBeInTheDocument();
  });

  it("calls onCreateProof when the button is clicked", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /Create Proof/i }));
    expect(baseProps.onCreateProof).toHaveBeenCalled();
  });

  it("disables the submit button when there are no periods", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} totalPeriods={0} coveredPeriods={0} />);

    expect(screen.getByRole("button", { name: /Create Proof/i })).toBeDisabled();
  });

  it("disables the submit button when the asset code is empty", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} assetCode="" />);

    expect(screen.getByRole("button", { name: /Create Proof/i })).toBeDisabled();
  });

  it("shows a loading label and disables the button while submitting", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} loading={true} />);

    const button = screen.getByRole("button", { name: /Creating proof/i });
    expect(button).toBeDisabled();
  });

  it("calls onExpiresInDaysChange when the expiry input changes", () => {
    render(<EmploymentContinuityConfirmation {...baseProps} />);

    fireEvent.change(screen.getByLabelText(/Expires in/i), { target: { value: "30" } });
    expect(baseProps.onExpiresInDaysChange).toHaveBeenCalledWith(30);
  });
});
