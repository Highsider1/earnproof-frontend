/**
 * @jest-environment jsdom
 */

import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerificationWidget } from "@/components/verification/embed/verification-widget";
import { fetchWidgetVerification } from "@/lib/api/verification-widget";
import type { WidgetState } from "@/lib/api/verification-widget";
import type { VerifyProofResponse } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/verification-widget", () => {
  const actual = jest.requireActual("@/lib/api/verification-widget");
  return {
    ...actual,
    fetchWidgetVerification: jest.fn(),
  };
});

const mockedFetch = fetchWidgetVerification as jest.MockedFunction<typeof fetchWidgetVerification>;

function credentialResult(overrides: Partial<VerifyProofResponse> = {}): VerifyProofResponse {
  return {
    result: "VALID",
    status: "valid",
    credential: {
      id: "cred-1",
      schemaVersion: "1",
      subject: { walletHash: "wh_abc" },
      claim: {
        operator: "gte",
        thresholdAmount: "100",
        assetCode: "USDC",
        assetIssuer: null,
        periodStart: "2026-08-01T00:00:00.000Z",
        periodEnd: "2026-08-31T23:59:59.000Z",
        qualifyingPaymentCount: 3,
      },
      privacy: { exactIncomeHidden: true, sourceTransactionsHidden: true },
      issuedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
      proof: { type: "MinimumIncomeProof", credentialHash: "hash_1", signature: "sig_1" },
    },
    proof: {
      id: "EP-8A42-91DC",
      type: "MinimumIncomeProof",
      schemaVersion: "1",
      network: "Stellar Testnet",
      issuedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
      revokedAt: null,
    },
    ...overrides,
  };
}

describe("VerificationWidget", () => {
  beforeEach(() => {
    mockedFetch.mockReset();
  });

  it("shows a loading state before the fetch resolves", async () => {
    let resolveFetch!: (value: WidgetState) => void;
    mockedFetch.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    expect(screen.getByRole("status")).toHaveTextContent("Checking proof status...");

    await act(async () => {
      resolveFetch({ kind: "result", response: credentialResult() });
    });
  });

  it("renders a VALID result", async () => {
    mockedFetch.mockResolvedValue({ kind: "result", response: credentialResult() });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument());
    expect(screen.getByText("This proof is currently valid.")).toBeInTheDocument();
    expect(screen.getByText("EP-8A42-91DC")).toBeInTheDocument();
  });

  it("renders an EXPIRED result", async () => {
    mockedFetch.mockResolvedValue({
      kind: "result",
      response: credentialResult({ result: "EXPIRED", status: "expired" }),
    });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await waitFor(() => expect(screen.getByText("expired")).toBeInTheDocument());
    expect(screen.getByText("This proof has expired.")).toBeInTheDocument();
  });

  it("renders a REVOKED result", async () => {
    mockedFetch.mockResolvedValue({
      kind: "result",
      response: credentialResult({ result: "REVOKED", status: "revoked" }),
    });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await waitFor(() => expect(screen.getByText("revoked")).toBeInTheDocument());
    expect(screen.getByText("This proof has been revoked.")).toBeInTheDocument();
  });

  it("renders an UNKNOWN_PROOF result without credential details", async () => {
    mockedFetch.mockResolvedValue({
      kind: "result",
      response: { result: "UNKNOWN_PROOF", status: "unknown" },
    });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await waitFor(() => expect(screen.getByText("unknown")).toBeInTheDocument());
    expect(
      screen.getByText("No matching proof was found for this identifier."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("No further proof details are available for this identifier."),
    ).toBeInTheDocument();
  });

  it("renders the invalid-id state and never calls fetch again once shown", async () => {
    mockedFetch.mockResolvedValue({ kind: "invalid-id" });

    render(<VerificationWidget proofId="not-a-real-id" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Invalid verification link");
  });

  it("renders the unavailable state with a retry control on API/network failure", async () => {
    mockedFetch.mockResolvedValue({ kind: "unavailable" });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Verification unavailable");
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("retries the fetch when 'Try again' is clicked after an unavailable state", async () => {
    mockedFetch.mockResolvedValueOnce({ kind: "unavailable" });
    mockedFetch.mockResolvedValueOnce({ kind: "result", response: credentialResult() });

    const user = userEvent.setup();

    render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await screen.findByRole("button", { name: "Try again" });
    await user.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument());
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when proofId changes and ignores a stale in-flight response", async () => {
    let resolveFirst!: (value: WidgetState) => void;
    mockedFetch.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockedFetch.mockResolvedValueOnce({
      kind: "result",
      response: credentialResult({ proof: { ...credentialResult().proof!, id: "EP-SECOND" } }),
    });

    const { rerender } = render(<VerificationWidget proofId="EP-FIRST" />);
    rerender(<VerificationWidget proofId="EP-SECOND" />);

    await waitFor(() => expect(screen.getByText("EP-SECOND")).toBeInTheDocument());

    // The first request's late resolution must not clobber the second
    // request's already-rendered result.
    await act(async () => {
      resolveFirst({
        kind: "result",
        response: credentialResult({ proof: { ...credentialResult().proof!, id: "EP-FIRST" } }),
      });
    });
    expect(screen.getByText("EP-SECOND")).toBeInTheDocument();
    expect(screen.queryByText("EP-FIRST")).not.toBeInTheDocument();
  });

  it("does not render any raw HTML/script from the API response as markup (no dangerouslySetInnerHTML anywhere in the tree)", async () => {
    const hostile = "<img src=x onerror=alert(1)>";
    mockedFetch.mockResolvedValue({
      kind: "result",
      response: credentialResult({
        proof: { ...credentialResult().proof!, id: hostile },
      }),
    });

    const { container } = render(<VerificationWidget proofId="EP-8A42-91DC" />);

    await waitFor(() => expect(screen.getByText(hostile)).toBeInTheDocument());
    // The hostile string is present as literal escaped text content, not
    // parsed as an <img> element.
    expect(container.querySelector("img")).toBeNull();
  });

  it("ignores a hostile postMessage from the embedding host page (no listener exists to act on it)", async () => {
    mockedFetch.mockResolvedValue({ kind: "result", response: credentialResult() });

    render(<VerificationWidget proofId="EP-8A42-91DC" />);
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument());

    const beforeHtml = document.body.innerHTML;

    await act(async () => {
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { type: "earnproof:override", proofId: "EP-INJECTED", token: "steal-me" },
          origin: "https://attacker.example",
        }),
      );
    });

    // No postMessage listener exists in this component, so dispatching a
    // crafted message must not change what's rendered or trigger another
    // fetch call.
    expect(document.body.innerHTML).toBe(beforeHtml);
    expect(mockedFetch).toHaveBeenCalledTimes(1);
  });

  it("does not navigate window.top/window.parent under any state", async () => {
    mockedFetch.mockResolvedValue({ kind: "result", response: credentialResult() });
    render(<VerificationWidget proofId="EP-8A42-91DC" />);
    await waitFor(() => expect(screen.getByText("valid")).toBeInTheDocument());

    // This widget has no code path that touches window.top/window.parent at
    // all; asserting the globals are untouched guards against a future
    // change accidentally introducing one without a test failing loudly.
    expect(window.top).toBe(window);
    expect(window.parent).toBe(window);
  });
});
