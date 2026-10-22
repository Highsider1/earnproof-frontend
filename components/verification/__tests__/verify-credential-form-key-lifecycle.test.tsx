/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyCredentialForm } from "../verify-credential-form";
import { apiClient } from "@/lib/api/client";
import { clearKeyDiscoveryCache } from "@/lib/key-lifecycle/registry";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
}));

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

const VALID_RESULT = {
  result: "VALID",
  status: "valid" as const,
  credential: {
    id: "cred-1",
    schemaVersion: "1",
    subject: { walletHash: "wh_abc" },
    claim: {
      operator: "gte" as const,
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
    id: "cred-1",
    type: "MinimumIncomeProof",
    schemaVersion: "1",
    network: "Stellar Testnet",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null,
  },
};

describe("VerifyCredentialForm key lifecycle linkage", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
    clearKeyDiscoveryCache();
  });

  it("shows the signing key's lifecycle state after a successful verification", async () => {
    mockedApiClient.mockResolvedValue(VALID_RESULT);

    const user = userEvent.setup();
    render(<VerifyCredentialForm />);

    fireEvent.change(screen.getByLabelText("Credential JSON"), {
      target: { value: JSON.stringify({ id: "cred-1" }) },
    });
    await user.click(screen.getByRole("button", { name: "Validate credential" }));

    await waitFor(() => {
      expect(screen.getByText("Signing key")).toBeInTheDocument();
    });

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows an unknown-key result for a proof type with no registered key", async () => {
    mockedApiClient.mockResolvedValue({
      ...VALID_RESULT,
      proof: { ...VALID_RESULT.proof, type: "SomeUnrecognizedProofType" },
    });

    const user = userEvent.setup();
    render(<VerifyCredentialForm />);

    fireEvent.change(screen.getByLabelText("Credential JSON"), {
      target: { value: JSON.stringify({ id: "cred-1" }) },
    });
    await user.click(screen.getByRole("button", { name: "Validate credential" }));

    await waitFor(() => {
      expect(screen.getByRole("alert", { name: "" })).toBeInTheDocument();
    });

    expect(screen.getByText(/not recognized/i)).toBeInTheDocument();
  });

  it("does not render a key lifecycle panel before any verification has run", () => {
    render(<VerifyCredentialForm />);
    expect(screen.queryByText("Signing key")).not.toBeInTheDocument();
  });
});
