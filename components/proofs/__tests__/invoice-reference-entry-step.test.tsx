/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { InvoiceReferenceEntryStep } from "../invoice-reference-entry-step";

describe("InvoiceReferenceEntryStep", () => {
  it("calls onRawReferenceChange when typing", () => {
    const onChange = jest.fn();
    render(<InvoiceReferenceEntryStep rawReference="" onRawReferenceChange={onChange} />);

    fireEvent.change(screen.getByLabelText(/Invoice reference/i), { target: { value: "INV-001" } });
    expect(onChange).toHaveBeenCalledWith("INV-001");
  });

  it("shows the normalized reference for a valid input", () => {
    render(<InvoiceReferenceEntryStep rawReference="inv-2026-001" onRawReferenceChange={jest.fn()} />);
    expect(screen.getByText("INV-2026-001")).toBeInTheDocument();
  });

  it("shows a validation error only after the field has been touched", () => {
    render(<InvoiceReferenceEntryStep rawReference="ab" onRawReferenceChange={jest.fn()} />);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.blur(screen.getByLabelText(/Invoice reference/i));
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("never renders the raw reference value anywhere but the input itself", () => {
    render(<InvoiceReferenceEntryStep rawReference="secret-raw-value" onRawReferenceChange={jest.fn()} />);
    expect(screen.queryByText("secret-raw-value")).not.toBeInTheDocument();
  });
});
