/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { AmountInput } from "../amount-input";

const NATIVE = { assetCode: "XLM", assetIssuer: null };
const ISSUED = { assetCode: "USDC", assetIssuer: "GISSUER000000000000000000000000000000000000000000000000" };

function ControlledAmountInput(props: Partial<React.ComponentProps<typeof AmountInput>> = {}) {
  const [value, setValue] = useState(props.value ?? "");
  return (
    <AmountInput
      label="Amount"
      value={value}
      onChange={setValue}
      asset={NATIVE}
      {...props}
    />
  );
}

describe("AmountInput", () => {
  it("renders the label and the asset code", () => {
    render(<ControlledAmountInput />);
    expect(screen.getByLabelText("Amount")).toBeInTheDocument();
    expect(screen.getByText("XLM")).toBeInTheDocument();
  });

  it("distinguishes an issued asset from the native asset", () => {
    render(<ControlledAmountInput asset={ISSUED} />);
    expect(screen.getByText("USDC (issued)")).toBeInTheDocument();
  });

  it("calls onChange as the user types", () => {
    render(<ControlledAmountInput />);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "12.5" } });
    expect(screen.getByLabelText("Amount")).toHaveValue("12.5");
  });

  it("shows a precision error for more than 7 decimal places and marks the field invalid", () => {
    render(<ControlledAmountInput />);
    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "1.12345678" } });

    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(/decimal places/);
  });

  it("shows no error for a valid amount", () => {
    render(<ControlledAmountInput value="12.5" />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an externally supplied error (e.g. a required-field message) when present", () => {
    render(<ControlledAmountInput externalError="Amount is required." />);
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is required.");
  });

  it("prefers its own precision error over an external error when both apply", () => {
    render(
      <ControlledAmountInput value="1.12345678" externalError="Amount is required." />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/decimal places/);
  });

  it("can be disabled", () => {
    render(<ControlledAmountInput disabled />);
    expect(screen.getByLabelText("Amount")).toBeDisabled();
  });
});
