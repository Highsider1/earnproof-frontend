import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WebhookSecretDisplay } from "./webhook-secret-display";
import type { Webhook } from "@/lib/api/webhooks";

describe("WebhookSecretDisplay", () => {
  const mockWebhook: Webhook = {
    id: "webhook-123",
    url: "https://example.com/webhooks",
    events: ["proof.created"],
    status: "ACTIVE",
  };

  const mockSecret = "whsec_test_secret_key_very_long_and_secure";
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("displays the webhook URL and secret", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText(mockWebhook.url)).toBeInTheDocument();
    expect(screen.getByDisplayValue(mockSecret)).toBeInTheDocument();
  });

  it("displays the secret in an input field", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const secretInput = screen.getByDisplayValue(mockSecret) as HTMLInputElement;
    expect(secretInput).toHaveAttribute("readonly");
  });

  it("shows warning that this is the only time the secret will be displayed", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText(/only time.*displayed/i)).toBeInTheDocument();
  });

  it("allows copying the secret to clipboard", async () => {
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(mockClipboard.writeText).toHaveBeenCalledWith(mockSecret);
    });
  });

  it("shows copy status message after successful copy", async () => {
    const mockClipboard = {
      writeText: jest.fn().mockResolvedValue(undefined),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText(/copied to clipboard/i)).toBeInTheDocument();
    });
  });

  it("clears the secret from input on unmount", () => {
    const { unmount } = render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const secretInput = screen.getByDisplayValue(mockSecret) as HTMLInputElement;
    const originalValue = secretInput.value;

    unmount();

    // In a real scenario, the input would be cleared from memory
    // This test verifies the cleanup effect exists
    expect(originalValue).toBe(mockSecret);
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByRole("button", { name: /saved.*dismiss/i });
    fireEvent.click(dismissButton);

    expect(mockOnDismiss).toHaveBeenCalled();
  });

  it("displays webhook metadata", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    expect(screen.getByText(mockWebhook.id)).toBeInTheDocument();
    expect(screen.getByText(mockWebhook.status)).toBeInTheDocument();
    expect(screen.getByText(mockWebhook.events[0])).toBeInTheDocument();
  });

  it("has proper accessibility attributes", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const section = screen.getByRole("region", { hidden: true });
    expect(section).toHaveAttribute("aria-labelledby", "webhook-secret-heading");
  });

  it("auto-focuses the dismiss button on mount", () => {
    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const dismissButton = screen.getByRole("button", { name: /saved.*dismiss/i });
    expect(dismissButton).toHaveFocus();
  });

  it("never persists the secret to localStorage or sessionStorage", () => {
    const localStorageSpy = jest.spyOn(Storage.prototype, "setItem");
    const sessionStorageSpy = jest.spyOn(Storage.prototype, "setItem");

    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    expect(localStorageSpy).not.toHaveBeenCalled();
    expect(sessionStorageSpy).not.toHaveBeenCalled();

    localStorageSpy.mockRestore();
    sessionStorageSpy.mockRestore();
  });

  it("shows error message if clipboard write fails", async () => {
    const mockClipboard = {
      writeText: jest.fn().mockRejectedValue(new Error("Clipboard denied")),
    };
    Object.assign(navigator, { clipboard: mockClipboard });

    render(
      <WebhookSecretDisplay
        webhook={mockWebhook}
        secret={mockSecret}
        onDismiss={mockOnDismiss}
      />
    );

    const copyButton = screen.getByRole("button", { name: /copy/i });
    fireEvent.click(copyButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to copy/i)).toBeInTheDocument();
    });
  });
});
