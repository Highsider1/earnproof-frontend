/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { UnsavedChangesDialog } from "../unsaved-changes-dialog";

describe("UnsavedChangesDialog", () => {
  it("has correct dialog accessibility attributes", () => {
    render(<UnsavedChangesDialog onStay={jest.fn()} onDiscard={jest.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby");
    expect(dialog).toHaveAttribute("aria-describedby");
  });

  it("focuses Stay by default", () => {
    render(<UnsavedChangesDialog onStay={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.getByRole("button", { name: "Stay" })).toHaveFocus();
  });

  it("calls onStay when Stay is clicked", () => {
    const onStay = jest.fn();
    render(<UnsavedChangesDialog onStay={onStay} onDiscard={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Stay" }));
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("calls onDiscard when Discard is clicked", () => {
    const onDiscard = jest.fn();
    render(<UnsavedChangesDialog onStay={jest.fn()} onDiscard={onDiscard} />);

    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it("does not render a Save draft button when onSaveDraft is not provided", () => {
    render(<UnsavedChangesDialog onStay={jest.fn()} onDiscard={jest.fn()} />);
    expect(screen.queryByRole("button", { name: "Save draft" })).not.toBeInTheDocument();
  });

  it("calls onSaveDraft when Save draft is clicked", () => {
    const onSaveDraft = jest.fn();
    render(
      <UnsavedChangesDialog onStay={jest.fn()} onDiscard={jest.fn()} onSaveDraft={onSaveDraft} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(onSaveDraft).toHaveBeenCalledTimes(1);
  });

  it("calls onStay on Escape", () => {
    const onStay = jest.fn();
    render(<UnsavedChangesDialog onStay={onStay} onDiscard={jest.fn()} />);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onStay).toHaveBeenCalledTimes(1);
  });

  it("disables all actions while processing", () => {
    render(
      <UnsavedChangesDialog
        onStay={jest.fn()}
        onDiscard={jest.fn()}
        onSaveDraft={jest.fn()}
        isProcessing
      />
    );

    expect(screen.getByRole("button", { name: "Stay" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
  });
});
