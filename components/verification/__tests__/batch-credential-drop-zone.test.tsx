/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { BatchCredentialDropZone } from "../batch-credential-drop-zone";

describe("BatchCredentialDropZone", () => {
  it("calls onFilesSelected when files are chosen via the input", () => {
    const onFilesSelected = jest.fn();
    render(<BatchCredentialDropZone onFilesSelected={onFilesSelected} disabled={false} />);

    const file = new File(["{}"], "credential.json", { type: "application/json" });
    const input = screen.getByLabelText(/Upload credential JSON files/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(onFilesSelected).toHaveBeenCalledWith([file]);
  });

  it("does not call onFilesSelected for an empty file list", () => {
    const onFilesSelected = jest.fn();
    render(<BatchCredentialDropZone onFilesSelected={onFilesSelected} disabled={false} />);

    const input = screen.getByLabelText(/Upload credential JSON files/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(onFilesSelected).not.toHaveBeenCalled();
  });

  it("disables the file input when disabled is true", () => {
    render(<BatchCredentialDropZone onFilesSelected={jest.fn()} disabled={true} />);
    expect(screen.getByLabelText(/Upload credential JSON files/i)).toBeDisabled();
  });

  it("marks the drop zone as aria-disabled when disabled", () => {
    render(<BatchCredentialDropZone onFilesSelected={jest.fn()} disabled={true} />);
    expect(screen.getByRole("button")).toHaveAttribute("aria-disabled", "true");
  });

  it("calls onFilesSelected with multiple dropped files", () => {
    const onFilesSelected = jest.fn();
    render(<BatchCredentialDropZone onFilesSelected={onFilesSelected} disabled={false} />);

    const fileA = new File(["{}"], "a.json", { type: "application/json" });
    const fileB = new File(["{}"], "b.json", { type: "application/json" });
    const dropZone = screen.getByRole("button");

    fireEvent.drop(dropZone, { dataTransfer: { files: [fileA, fileB] } });

    expect(onFilesSelected).toHaveBeenCalledWith([fileA, fileB]);
  });
});
