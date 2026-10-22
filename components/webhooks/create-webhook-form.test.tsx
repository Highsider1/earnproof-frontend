import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CreateWebhookForm } from "./create-webhook-form";
import * as webhookApi from "@/lib/api/webhooks";

jest.mock("@/lib/api/webhooks", () => ({
  createWebhook: jest.fn(),
}));

describe("CreateWebhookForm", () => {
  const mockToken = "test-token";
  const mockOnWebhookCreated = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders the form with URL and event inputs", () => {
    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    expect(screen.getByLabelText(/webhook url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/events to subscribe/i)).toBeInTheDocument();
  });

  it("renders all event options", () => {
    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    expect(screen.getByText("Proof Created")).toBeInTheDocument();
    expect(screen.getByText("Proof Verified")).toBeInTheDocument();
    expect(screen.getByText("Proof Revoked")).toBeInTheDocument();
  });

  it("shows SSRF guidance when URL has error", async () => {
    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://127.0.0.1/webhooks");
    fireEvent.blur(urlInput);

    await waitFor(() => {
      const guidance = screen.getByText(/private IP ranges|localhost|link-local/i);
      expect(guidance).toBeInTheDocument();
    });
  });

  it("accepts HTTPS URLs", async () => {
    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://webhook.site/abc123");
    fireEvent.blur(urlInput);

    await waitFor(() => {
      const errorMessages = screen.queryAllByRole("alert");
      const urlError = errorMessages.find((el) =>
        el.textContent?.includes("http")
      );
      expect(urlError).not.toBeInTheDocument();
    });
  });

  it("rejects HTTP URLs", async () => {
    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "http://example.com/webhooks");
    fireEvent.blur(urlInput);

    await waitFor(() => {
      expect(screen.getByText(/https/i)).toBeInTheDocument();
    });
  });

  it("validates that at least one event is selected", async () => {
    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
    });
  });

  it("enables submit button when URL and events are valid", async () => {
    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i);
    await user.click(proofCreatedCheckbox);

    await waitFor(() => {
      const submitButton = screen.getByRole("button", { name: /create webhook/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it("calls createWebhook API with correct parameters", async () => {
    const mockResponse = {
      webhook: {
        id: "webhook-123",
        url: "https://example.com/webhooks",
        events: ["proof.created"],
        status: "ACTIVE" as const,
      },
      secret: "whsec_test_secret",
    };

    (webhookApi.createWebhook as jest.Mock).mockResolvedValue(mockResponse);

    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i);
    await user.click(proofCreatedCheckbox);

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(webhookApi.createWebhook).toHaveBeenCalledWith(
        mockToken,
        {
          url: "https://example.com/webhooks",
          events: ["proof.created"],
        },
        expect.any(AbortSignal)
      );
    });
  });

  it("calls onWebhookCreated with response after successful creation", async () => {
    const mockResponse = {
      webhook: {
        id: "webhook-123",
        url: "https://example.com/webhooks",
        events: ["proof.created"],
        status: "ACTIVE" as const,
      },
      secret: "whsec_test_secret",
    };

    (webhookApi.createWebhook as jest.Mock).mockResolvedValue(mockResponse);

    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i);
    await user.click(proofCreatedCheckbox);

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(mockOnWebhookCreated).toHaveBeenCalledWith(mockResponse);
    });
  });

  it("shows loading state while submitting", async () => {
    const mockResponse = {
      webhook: {
        id: "webhook-123",
        url: "https://example.com/webhooks",
        events: ["proof.created"],
        status: "ACTIVE" as const,
      },
      secret: "whsec_test_secret",
    };

    (webhookApi.createWebhook as jest.Mock).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
    );

    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i);
    await user.click(proofCreatedCheckbox);

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    await user.click(submitButton);

    expect(screen.getByRole("button", { name: /creating/i })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockOnWebhookCreated).toHaveBeenCalled();
    });
  });

  it("shows error message on API failure", async () => {
    (webhookApi.createWebhook as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );

    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i);
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i);
    await user.click(proofCreatedCheckbox);

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to create webhook/i)).toBeInTheDocument();
    });
  });

  it("clears form after successful creation", async () => {
    const mockResponse = {
      webhook: {
        id: "webhook-123",
        url: "https://example.com/webhooks",
        events: ["proof.created"],
        status: "ACTIVE" as const,
      },
      secret: "whsec_test_secret",
    };

    (webhookApi.createWebhook as jest.Mock).mockResolvedValue(mockResponse);

    const user = userEvent.setup();

    render(
      <CreateWebhookForm token={mockToken} onWebhookCreated={mockOnWebhookCreated} />
    );

    const urlInput = screen.getByPlaceholderText(/https:\/\/example.com/i) as HTMLInputElement;
    await user.type(urlInput, "https://example.com/webhooks");

    const proofCreatedCheckbox = screen.getByLabelText(/proof created/i) as HTMLInputElement;
    await user.click(proofCreatedCheckbox);

    const submitButton = screen.getByRole("button", { name: /create webhook/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(urlInput.value).toBe("");
      expect(proofCreatedCheckbox.checked).toBe(false);
    });
  });
});
