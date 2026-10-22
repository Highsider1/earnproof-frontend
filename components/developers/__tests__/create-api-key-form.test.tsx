/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CreateApiKeyForm } from "../create-api-key-form";
import { createApiKey } from "@/lib/api/keys";

jest.mock("@/lib/api/keys", () => ({
  ...jest.requireActual("@/lib/api/keys"),
  createApiKey: jest.fn(),
}));

const mockCreateApiKey = createApiKey as jest.MockedFunction<typeof createApiKey>;

function renderForm(onKeyCreated = jest.fn()) {
  render(<CreateApiKeyForm token="test-token" onKeyCreated={onKeyCreated} />);
  return { onKeyCreated };
}

function fillName(name: string) {
  fireEvent.change(screen.getByLabelText("Key Name"), { target: { value: name } });
}

describe("CreateApiKeyForm", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders scopes grouped by category", () => {
    renderForm();
    expect(screen.getByText("Verification")).toBeInTheDocument();
    expect(screen.getByText("Proofs")).toBeInTheDocument();
    expect(screen.getByText("Webhooks")).toBeInTheDocument();
  });

  it("marks the review button as accessible via its label and disables it for an empty scope set", () => {
    renderForm();
    const reviewButton = screen.getByRole("button", { name: "Review permissions" });
    expect(reviewButton).toBeDisabled();
  });

  it("every scope checkbox is reachable by its accessible label (keyboard/screen-reader users can review all permissions)", () => {
    renderForm();
    expect(screen.getByLabelText(/Verification Read/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Proof Creation/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Proof Read/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Webhook Management/)).toBeInTheDocument();
  });

  it("flags a broad scope's checkbox with a visible 'Broad' indicator", () => {
    renderForm();
    const webhookLabel = screen.getByLabelText(/Webhook Management/).closest("label");
    expect(webhookLabel).toHaveTextContent("Broad");

    const proofsReadLabel = screen.getByLabelText(/Proof Read/).closest("label");
    expect(proofsReadLabel).not.toHaveTextContent("Broad");
  });

  it("does nothing on submit for an empty scope set (submit stays disabled)", () => {
    renderForm();
    fillName("My Integration");
    expect(screen.getByRole("button", { name: "Review permissions" })).toBeDisabled();
    expect(screen.queryByText("Review permissions")).toBeInTheDocument();
    expect(screen.queryByText(/This key will be able to/)).not.toBeInTheDocument();
  });

  it("moves to the review step with exactly the selected minimal scope set", async () => {
    renderForm();
    fillName("My Integration");
    fireEvent.click(screen.getByLabelText(/Proof Read/));
    fireEvent.click(screen.getByRole("button", { name: "Review permissions" }));

    expect(await screen.findByText(/Confirm this is exactly/)).toBeInTheDocument();
    expect(screen.getByText(/Read proof metadata and status/)).toBeInTheDocument();
    expect(screen.queryByText(/broad permission/i)).not.toBeInTheDocument();
  });

  it("moves to the review step and warns for a broad scope set", async () => {
    renderForm();
    fillName("My Integration");
    fireEvent.click(screen.getByLabelText(/Webhook Management/));
    fireEvent.click(screen.getByRole("button", { name: "Review permissions" }));

    expect(await screen.findByText(/broad permission/i)).toBeInTheDocument();
  });

  it("submits exactly the reviewed scopes to createApiKey, unchanged", async () => {
    mockCreateApiKey.mockResolvedValueOnce({
      apiKey: { id: "key-1", name: "My Integration", prefix: "abcd1234", scopes: ["proofs:read", "verification:read"] },
      secret: "secret-value",
    });

    const { onKeyCreated } = renderForm();
    fillName("My Integration");
    fireEvent.click(screen.getByLabelText(/Proof Read/));
    fireEvent.click(screen.getByLabelText(/Verification Read/));
    fireEvent.click(screen.getByRole("button", { name: "Review permissions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create API Key" }));

    await waitFor(() => expect(mockCreateApiKey).toHaveBeenCalledTimes(1));
    const [, request] = mockCreateApiKey.mock.calls[0];
    expect(request.scopes.sort()).toEqual(["proofs:read", "verification:read"].sort());
    expect(onKeyCreated).toHaveBeenCalledTimes(1);
  });

  it("returns to the form via Back without submitting", async () => {
    renderForm();
    fillName("My Integration");
    fireEvent.click(screen.getByLabelText(/Proof Read/));
    fireEvent.click(screen.getByRole("button", { name: "Review permissions" }));

    fireEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(screen.getByText("Create API Key")).toBeInTheDocument();
    expect(mockCreateApiKey).not.toHaveBeenCalled();
    // The previously entered name/scope selection survive the round trip.
    expect(screen.getByLabelText("Key Name")).toHaveValue("My Integration");
    expect(screen.getByLabelText(/Proof Read/)).toBeChecked();
  });

  it("shows an error and stays on the review step if creation fails", async () => {
    mockCreateApiKey.mockRejectedValueOnce(new Error("network error"));

    renderForm();
    fillName("My Integration");
    fireEvent.click(screen.getByLabelText(/Proof Read/));
    fireEvent.click(screen.getByRole("button", { name: "Review permissions" }));
    fireEvent.click(await screen.findByRole("button", { name: "Create API Key" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/Failed to create API key/);
    expect(screen.getByText(/Confirm this is exactly/)).toBeInTheDocument();
  });
});
