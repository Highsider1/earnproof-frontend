/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TrustedSourceForm } from "../trusted-source-form";
import { testTrustedSourceConnection } from "@/lib/api/trusted-sources";

jest.mock("@/lib/api/trusted-sources", () => ({
  testTrustedSourceConnection: jest.fn(),
}));

const mockedTest = testTrustedSourceConnection as jest.Mock;

function fillForm() {
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Payroll" } });
  fireEvent.change(screen.getByLabelText("Endpoint"), {
    target: { value: "https://payroll.example.com" },
  });
  fireEvent.change(screen.getByLabelText("API key"), {
    target: { value: "secret-key" },
  });
}

describe("TrustedSourceForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disables Test connection until endpoint and API key are filled", () => {
    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);

    expect(screen.getByRole("button", { name: /test connection/i })).toBeDisabled();
    fillForm();
    expect(screen.getByRole("button", { name: /test connection/i })).not.toBeDisabled();
  });

  it("shows a success diagnostic panel on a successful test", async () => {
    mockedTest.mockResolvedValue({
      status: "success",
      message: "Connection succeeded.",
      testedAt: new Date().toISOString(),
    });

    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    expect(await screen.findByRole("status")).toHaveTextContent("Connected");
  });

  it("shows a failure diagnostic panel with an alert role on failure", async () => {
    mockedTest.mockResolvedValue({
      status: "unauthorized",
      message: "Rejected: invalid API key.",
      testedAt: new Date().toISOString(),
    });

    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Unauthorized");
  });

  it("invalidates a prior successful test result when a field changes", async () => {
    mockedTest.mockResolvedValue({
      status: "success",
      message: "Connection succeeded.",
      testedAt: new Date().toISOString(),
    });

    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    await screen.findByRole("status");

    fireEvent.change(screen.getByLabelText("Endpoint"), {
      target: { value: "https://changed.example.com" },
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("calls onSave with the current config on submit, separate from testing", () => {
    const onSave = jest.fn();
    render(<TrustedSourceForm token="token" onSave={onSave} />);
    fillForm();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      name: "Payroll",
      endpoint: "https://payroll.example.com",
      apiKey: "secret-key",
    });
    expect(mockedTest).not.toHaveBeenCalled();
  });

  it("never echoes the raw API key value into the diagnostic panel", async () => {
    mockedTest.mockResolvedValue({
      status: "unauthorized",
      message: "Rejected: invalid API key.",
      testedAt: new Date().toISOString(),
    });

    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);
    fillForm();
    fireEvent.click(screen.getByRole("button", { name: /test connection/i }));
    const panel = await screen.findByRole("alert");

    expect(panel).not.toHaveTextContent("secret-key");
  });

  it("masks the API key input as a password field so it is not visible on screen", () => {
    render(<TrustedSourceForm token="token" onSave={jest.fn()} />);
    expect(screen.getByLabelText("API key")).toHaveAttribute("type", "password");
  });
});
