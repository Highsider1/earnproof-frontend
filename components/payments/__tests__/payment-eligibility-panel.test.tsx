import { render, screen, waitFor } from "@testing-library/react";
import { PaymentEligibilityPanel } from "../payment-eligibility-panel";
import { listPayments } from "@/lib/api/payments";
import type { Payment } from "@/lib/api/payments";

jest.mock("@/lib/api/payments", () => ({
  listPayments: jest.fn(),
}));
const mockListPayments = listPayments as jest.MockedFunction<typeof listPayments>;

const PAYMENT: Payment = {
  id: "payment-1",
  stellarTransactionHash: "a".repeat(64),
  sourceAddress: "GSOURCE",
  assetCode: "USDC",
  occurredAt: "2026-06-01T12:00:00.000Z",
  classification: "INCOME",
  isEligible: true,
};

beforeEach(() => {
  mockListPayments.mockReset();
});

describe("PaymentEligibilityPanel", () => {
  it("shows the eligibility explanation once the payment loads", async () => {
    mockListPayments.mockResolvedValue([PAYMENT]);

    render(<PaymentEligibilityPanel token="tok" paymentId="payment-1" />);

    await waitFor(() => {
      expect(screen.getByText("Eligible")).toBeInTheDocument();
    });
  });

  it("shows an error when the payment id is not found in the list", async () => {
    mockListPayments.mockResolvedValue([{ ...PAYMENT, id: "other-payment" }]);

    render(<PaymentEligibilityPanel token="tok" paymentId="payment-1" />);

    await waitFor(() => {
      expect(screen.getByText("This payment could not be found.")).toBeInTheDocument();
    });
  });

  it("refetches when refreshToken changes (post classification/policy change)", async () => {
    mockListPayments.mockResolvedValue([PAYMENT]);

    const { rerender } = render(
      <PaymentEligibilityPanel token="tok" paymentId="payment-1" refreshToken={1} />,
    );
    await waitFor(() => expect(mockListPayments).toHaveBeenCalledTimes(1));

    mockListPayments.mockResolvedValue([{ ...PAYMENT, classification: "EXCLUDED", isEligible: false }]);
    rerender(<PaymentEligibilityPanel token="tok" paymentId="payment-1" refreshToken={2} />);

    await waitFor(() => expect(mockListPayments).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getAllByText("Excluded").length).toBeGreaterThan(0));
  });

  it("marks the explanation stale on a refresh failure instead of clearing it (stale-decision case)", async () => {
    mockListPayments.mockResolvedValueOnce([PAYMENT]);
    const { rerender } = render(
      <PaymentEligibilityPanel token="tok" paymentId="payment-1" refreshToken={1} />,
    );
    await waitFor(() => expect(screen.getByText("Eligible")).toBeInTheDocument());

    mockListPayments.mockRejectedValueOnce(new Error("network down"));
    rerender(<PaymentEligibilityPanel token="tok" paymentId="payment-1" refreshToken={2} />);

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(/may be out of date/i);
    });
    // Last-known data is preserved, not cleared.
    expect(screen.getByText("Eligible")).toBeInTheDocument();
  });
});
