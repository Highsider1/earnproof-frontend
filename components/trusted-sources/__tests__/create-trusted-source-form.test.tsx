import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateTrustedSourceForm } from "../create-trusted-source-form";

const USER_ID = "user-1";
const ISSUERS = [
  { id: "iss-1", name: "Acme Issuer", status: "ACTIVE" as const },
  { id: "iss-2", name: "Beta Issuer", status: "ACTIVE" as const },
];

beforeEach(() => {
  window.localStorage.clear();
});

describe("CreateTrustedSourceForm", () => {
  it("creates a trusted source and calls onTrustedSourceCreated", async () => {
    const onCreated = jest.fn();
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={ISSUERS}
        onTrustedSourceCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme Payroll" },
    });
    fireEvent.change(screen.getByLabelText("Linked issuer"), {
      target: { value: "iss-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add trusted source" }));

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Acme Payroll", issuerId: "iss-1" }),
      );
    });
  });

  it("rejects submission with no name (negative case)", async () => {
    const onCreated = jest.fn();
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={ISSUERS}
        onTrustedSourceCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Linked issuer"), {
      target: { value: "iss-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add trusted source" }));

    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("rejects submission with no issuer selected (negative case)", async () => {
    const onCreated = jest.fn();
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={ISSUERS}
        onTrustedSourceCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Acme Payroll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add trusted source" }));

    await waitFor(() => {
      expect(screen.getByText("An issuer must be selected")).toBeInTheDocument();
    });
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("rejects a name shorter than the minimum length (boundary case)", async () => {
    const onCreated = jest.fn();
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={ISSUERS}
        onTrustedSourceCreated={onCreated}
      />,
    );

    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "A" } });
    fireEvent.change(screen.getByLabelText("Linked issuer"), {
      target: { value: "iss-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add trusted source" }));

    await waitFor(() => {
      expect(onCreated).not.toHaveBeenCalled();
    });
  });

  it("disables submission and shows a disabled-state message when there are no issuers to link", () => {
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={[]}
        onTrustedSourceCreated={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Add trusted source" })).toBeDisabled();
    expect(screen.getByText("No issuers available")).toBeInTheDocument();
  });

  it("clears the form after a successful submission", async () => {
    render(
      <CreateTrustedSourceForm
        userId={USER_ID}
        issuers={ISSUERS}
        onTrustedSourceCreated={jest.fn()}
      />,
    );

    const nameInput = screen.getByLabelText("Name") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Acme Payroll" } });
    fireEvent.change(screen.getByLabelText("Linked issuer"), {
      target: { value: "iss-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add trusted source" }));

    await waitFor(() => expect(nameInput.value).toBe(""));
  });
});
