import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { TrustedSourceList } from "../trusted-source-list";
import { createTrustedSource } from "@/lib/trusted-sources/store";

const USER_ID = "user-1";
const ISSUERS = [
  { id: "iss-1", name: "Acme Issuer", status: "ACTIVE" as const },
  { id: "iss-2", name: "Beta Issuer", status: "ACTIVE" as const },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("TrustedSourceList", () => {
  it("shows an empty state when there are no trusted sources", () => {
    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    expect(
      screen.getByText("No trusted sources yet. Add your first one above."),
    ).toBeInTheDocument();
  });

  it("resolves and displays the linked issuer's name", () => {
    const record = createTrustedSource(USER_ID, { name: "Acme Payroll", issuerId: "iss-1" });

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    expect(screen.getByText("Acme Issuer")).toBeInTheDocument();
  });

  it("shows a fallback label when the linked issuer is not in the current issuer list", () => {
    const record = createTrustedSource(USER_ID, { name: "Orphaned", issuerId: "iss-missing" });

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    expect(screen.getByText("Unknown issuer")).toBeInTheDocument();
  });

  it("edits a trusted source's name and issuer", async () => {
    const record = createTrustedSource(USER_ID, { name: "Original", issuerId: "iss-1" });
    const onUpdated = jest.fn();

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={onUpdated}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Trusted source name"), {
      target: { value: "Renamed" },
    });
    fireEvent.change(screen.getByLabelText("Linked issuer"), {
      target: { value: "iss-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Renamed", issuerId: "iss-2" }),
      );
    });
  });

  it("cancelling an edit discards unsaved changes", () => {
    const record = createTrustedSource(USER_ID, { name: "Original", issuerId: "iss-1" });

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByLabelText("Trusted source name"), {
      target: { value: "Should not persist" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.queryByText("Should not persist")).not.toBeInTheDocument();
  });

  it("requires confirmation before deleting (destructive-action requirement)", () => {
    const record = createTrustedSource(USER_ID, { name: "To delete", issuerId: "iss-1" });
    const onDeleted = jest.fn();

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("deletes only after the confirmation dialog is confirmed", async () => {
    const record = createTrustedSource(USER_ID, { name: "To delete", issuerId: "iss-1" });
    const onDeleted = jest.fn();

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent.click(within(dialog).getByRole("button", { name: "Delete", hidden: true }));

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith(record.id);
    });
  });

  it("cancelling the delete confirmation does not delete", () => {
    const record = createTrustedSource(USER_ID, { name: "Keep me", issuerId: "iss-1" });
    const onDeleted = jest.fn();

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={onDeleted}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores focus to the row's delete button after confirming delete", async () => {
    const recordA = createTrustedSource(USER_ID, { name: "Row A", issuerId: "iss-1" });
    const recordB = createTrustedSource(USER_ID, { name: "Row B", issuerId: "iss-2" });

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[recordA, recordB]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    const deleteButtons = screen.getAllByRole("button", { name: "Delete" });
    const secondDeleteButton = deleteButtons[1]!;
    secondDeleteButton.focus();
    fireEvent.click(secondDeleteButton);

    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));

    await waitFor(() => {
      expect(document.activeElement).toBe(secondDeleteButton);
    });
  });

  it("restores focus to the row's delete button after cancelling delete", async () => {
    const record = createTrustedSource(USER_ID, { name: "Row A", issuerId: "iss-1" });

    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[record]}
        issuers={ISSUERS}
        loading={false}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Cancel", hidden: true }));

    await waitFor(() => {
      expect(document.activeElement).toBe(deleteButton);
    });
  });

  it("shows a loading state while there are no trusted sources yet and loading is true", () => {
    render(
      <TrustedSourceList
        userId={USER_ID}
        trustedSources={[]}
        issuers={ISSUERS}
        loading={true}
        onTrustedSourceUpdated={jest.fn()}
        onTrustedSourceDeleted={jest.fn()}
      />,
    );

    expect(screen.getByText("Loading trusted sources...")).toBeInTheDocument();
  });
});
