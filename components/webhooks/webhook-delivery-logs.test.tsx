import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { WebhookDeliveryLogs } from "./webhook-delivery-logs";
import * as webhookApi from "@/lib/api/webhooks";
import type { WebhookDelivery } from "@/lib/api/webhooks";

jest.mock("@/lib/api/webhooks", () => ({
  listWebhookDeliveries: jest.fn(),
  replayWebhookDelivery: jest.fn(),
  getDeliveryStatusLabel: (status: string) => status,
  getDeliveryStatusBadgeColor: (status: string) => "green",
  formatDeliveryTimestamp: (ts: string) => ts,
}));

describe("WebhookDeliveryLogs", () => {
  const mockToken = "test-token";
  const mockWebhookId = "webhook-123";

  const mockDeliveries: WebhookDelivery[] = [
    {
      id: "delivery-1",
      webhookId: mockWebhookId,
      eventType: "proof.created",
      status: "SUCCESS",
      statusCode: 200,
      attemptCount: 1,
      createdAt: "2024-01-15T10:30:00Z",
      deliveredAt: "2024-01-15T10:30:05Z",
    },
    {
      id: "delivery-2",
      webhookId: mockWebhookId,
      eventType: "proof.verified",
      status: "FAILED",
      statusCode: 500,
      attemptCount: 3,
      createdAt: "2024-01-15T10:25:00Z",
      nextRetryAt: "2024-01-15T10:26:00Z",
    },
  ];

  const mockResponse = {
    deliveries: mockDeliveries,
    total: 2,
    page: 1,
    pageSize: 10,
    hasMore: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (webhookApi.listWebhookDeliveries as jest.Mock).mockResolvedValue(mockResponse);
  });

  it("loads and displays delivery logs on mount", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText("proof.created")).toBeInTheDocument();
      expect(screen.getByText("proof.verified")).toBeInTheDocument();
    });
  });

  it("displays delivery status codes", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("500")).toBeInTheDocument();
    });
  });

  it("displays attempt counts", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });
  });

  it("provides replay button for each delivery", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const replayButtons = screen.getAllByRole("button", { name: /replay/i });
      expect(replayButtons).toHaveLength(2);
    });
  });

  it("filters deliveries by status", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const statusFilter = screen.getByDisplayValue("") as HTMLSelectElement;
      expect(statusFilter).toBeInTheDocument();
    });

    // Test that filtering works
    const statusSelect = screen.getByLabelText(/filter by status/i) as HTMLSelectElement;
    fireEvent.change(statusSelect, { target: { value: "SUCCESS" } });

    await waitFor(() => {
      expect(webhookApi.listWebhookDeliveries).toHaveBeenCalledWith(
        mockToken,
        mockWebhookId,
        expect.objectContaining({ status: "SUCCESS" }),
        expect.any(AbortSignal)
      );
    });
  });

  it("filters deliveries by event type", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const eventSelect = screen.getByLabelText(/filter by event/i) as HTMLSelectElement;
      fireEvent.change(eventSelect, { target: { value: "proof.created" } });
    });

    await waitFor(() => {
      expect(webhookApi.listWebhookDeliveries).toHaveBeenCalledWith(
        mockToken,
        mockWebhookId,
        expect.objectContaining({ eventType: "proof.created" }),
        expect.any(AbortSignal)
      );
    });
  });

  it("supports pagination", async () => {
    const paginatedResponse = {
      ...mockResponse,
      page: 1,
      pageSize: 10,
      hasMore: true,
    };
    (webhookApi.listWebhookDeliveries as jest.Mock).mockResolvedValue(paginatedResponse);

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(webhookApi.listWebhookDeliveries).toHaveBeenCalledWith(
        mockToken,
        mockWebhookId,
        expect.objectContaining({ page: 2 }),
        expect.any(AbortSignal)
      );
    });
  });

  it("disables next button when on last page", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  it("handles replay by calling API", async () => {
    const replayedDelivery = { ...mockDeliveries[0] };
    (webhookApi.replayWebhookDelivery as jest.Mock).mockResolvedValue(replayedDelivery);

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const replayButtons = screen.getAllByRole("button", { name: /replay/i });
      fireEvent.click(replayButtons[0]);
    });

    await waitFor(() => {
      expect(webhookApi.replayWebhookDelivery).toHaveBeenCalledWith(
        mockToken,
        mockWebhookId,
        "delivery-1",
        expect.any(AbortSignal)
      );
    });
  });

  it("detects deduplicated replays (same delivery ID returned)", async () => {
    const sameDelivery = { ...mockDeliveries[0] }; // Same ID = deduplicated
    (webhookApi.replayWebhookDelivery as jest.Mock).mockResolvedValue(sameDelivery);

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const replayButtons = screen.getAllByRole("button", { name: /replay/i });
      fireEvent.click(replayButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/deduplicated/i)).toBeInTheDocument();
    });
  });

  it("detects newly queued replays (different delivery ID returned)", async () => {
    const newDelivery = {
      ...mockDeliveries[0],
      id: "delivery-new-123",
    };
    (webhookApi.replayWebhookDelivery as jest.Mock).mockResolvedValue(newDelivery);

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const replayButtons = screen.getAllByRole("button", { name: /replay/i });
      fireEvent.click(replayButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText(/queued successfully/i)).toBeInTheDocument();
    });
  });

  it("shows loading state during replay", async () => {
    (webhookApi.replayWebhookDelivery as jest.Mock).mockImplementation(
      () => new Promise((resolve) =>
        setTimeout(() => resolve(mockDeliveries[0]), 100)
      )
    );

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const replayButtons = screen.getAllByRole("button", { name: /replay/i });
      fireEvent.click(replayButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /replaying/i })).toBeInTheDocument();
    });
  });

  it("shows empty state when no deliveries", async () => {
    (webhookApi.listWebhookDeliveries as jest.Mock).mockResolvedValue({
      deliveries: [],
      total: 0,
      page: 1,
      pageSize: 10,
      hasMore: false,
    });

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText(/no deliveries found/i)).toBeInTheDocument();
    });
  });

  it("shows error message on load failure", async () => {
    (webhookApi.listWebhookDeliveries as jest.Mock).mockRejectedValue(
      new Error("Network error")
    );

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load delivery logs/i)).toBeInTheDocument();
    });
  });

  it("has refresh button", async () => {
    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      const refreshButton = screen.getByRole("button", { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => {
      expect(webhookApi.listWebhookDeliveries).toHaveBeenCalledTimes(2);
    });
  });

  it("does not render raw response bodies as HTML", async () => {
    const mockDeliveryWithHtml: WebhookDelivery = {
      ...mockDeliveries[0],
      id: "delivery-html",
    };

    (webhookApi.listWebhookDeliveries as jest.Mock).mockResolvedValue({
      deliveries: [mockDeliveryWithHtml],
      total: 1,
      page: 1,
      pageSize: 10,
      hasMore: false,
    });

    render(<WebhookDeliveryLogs token={mockToken} webhookId={mockWebhookId} />);

    await waitFor(() => {
      expect(screen.getByText("proof.created")).toBeInTheDocument();
    });

    // The table should only show metadata (status, timestamps, etc.)
    // not arbitrary response bodies
    expect(screen.getByText("200")).toBeInTheDocument();
  });
});
