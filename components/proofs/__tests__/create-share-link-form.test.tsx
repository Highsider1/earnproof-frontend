/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { CreateShareLinkForm } from "../create-share-link-form";

describe("CreateShareLinkForm", () => {
  it("defaults to hiding both amount and sender", () => {
    render(<CreateShareLinkForm onCreate={jest.fn()} creating={false} />);
    expect(screen.getByText("Hide the exact amount")).toBeInTheDocument();
    expect(screen.getByText("Hide the sender")).toBeInTheDocument();
  });

  it("calls onCreate with the selected expiry and disclosure policy", () => {
    const onCreate = jest.fn();
    render(<CreateShareLinkForm onCreate={onCreate} creating={false} />);

    fireEvent.click(screen.getByLabelText("1 hour"));
    fireEvent.click(screen.getByLabelText("Disclose exact amount"));
    fireEvent.click(screen.getByRole("button", { name: /Create share link/i }));

    expect(onCreate).toHaveBeenCalledWith({ expiresInHours: 1, discloseAmount: true, discloseSender: false });
  });

  it("updates the policy summary as options change", () => {
    render(<CreateShareLinkForm onCreate={jest.fn()} creating={false} />);

    fireEvent.click(screen.getByLabelText("Disclose sender"));

    expect(screen.getByText("Disclose the sender")).toBeInTheDocument();
  });

  it("disables the submit button while creating", () => {
    render(<CreateShareLinkForm onCreate={jest.fn()} creating={true} />);
    expect(screen.getByRole("button", { name: /Creating/i })).toBeDisabled();
  });
});
