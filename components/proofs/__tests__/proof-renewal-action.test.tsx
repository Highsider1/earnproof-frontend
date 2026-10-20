import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ProofRenewalAction } from "../proof-renewal-action";
import { recordRenewal } from "@/lib/proof-renewal/store";
import type { ProofListItem } from "@/lib/api/proofs-list";

const USER_ID = "user-1";
const ISSUER_ID = "issuer-1";

function makeProof(overrides: Partial<ProofListItem> = {}): ProofListItem {
  return {
    id: "proof-1",
    type: "MINIMUM_INCOME",
    status: "VALID",
    issuerId: ISSUER_ID,
    issuerName: "Acme Issuer",
    createdAt: "2026-01-01T00:00:00.000Z",
    expiresAt: "2026-02-01T00:00:00.000Z",
    revokedAt: null,
    summary: { assetCode: "USDC", assetIssuer: "GISSUER" },
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("ProofRenewalAction", () => {
  it("shows a disabled explanation instead of a Renew button for a revoked proof (negative/eligibility case)", () => {
    const proof = makeProof({ status: "REVOKED", revokedAt: "2026-01-15T00:00:00.000Z" });

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={jest.fn()}
        onRenewed={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /renew/i })).not.toBeInTheDocument();
    expect(screen.getByText("Renewal unavailable")).toBeInTheDocument();
  });

  it("shows a disabled explanation for a caller that does not own the proof (authorization case)", () => {
    const proof = makeProof({ issuerId: "issuer-1" });

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId="issuer-2"
        onCreateSuccessor={jest.fn()}
        onRenewed={jest.fn()}
      />,
    );

    expect(screen.getByText("Renewal unavailable")).toBeInTheDocument();
  });

  it("shows the Renew button for an eligible (expired, owned, not revoked) proof (boundary case)", () => {
    const proof = makeProof({ status: "EXPIRED" });

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={jest.fn()}
        onRenewed={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /renew this proof/i })).toBeInTheDocument();
  });

  it("passes only safe policy fields (asset identity) to onCreateSuccessor, not sensitive data", async () => {
    const proof = makeProof();
    const onCreateSuccessor = jest.fn().mockResolvedValue({ id: "proof-2", type: "MINIMUM_INCOME" });

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={onCreateSuccessor}
        onRenewed={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /renew this proof/i }));

    await waitFor(() => {
      expect(onCreateSuccessor).toHaveBeenCalledWith({
        assetCode: "USDC",
        assetIssuer: "GISSUER",
      });
    });
  });

  it("records the renewal link and calls onRenewed on success", async () => {
    const proof = makeProof();
    const onCreateSuccessor = jest.fn().mockResolvedValue({ id: "proof-2", type: "MINIMUM_INCOME" });
    const onRenewed = jest.fn();

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={onCreateSuccessor}
        onRenewed={onRenewed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /renew this proof/i }));

    await waitFor(() => {
      expect(onRenewed).toHaveBeenCalledWith("proof-2");
    });
  });

  it("rejects a successor of an incompatible type without recording a link (incompatible-type case)", async () => {
    const proof = makeProof({ type: "MINIMUM_INCOME" });
    const onCreateSuccessor = jest
      .fn()
      .mockResolvedValue({ id: "proof-2", type: "PAYMENT_RECEIPT" });
    const onRenewed = jest.fn();

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={onCreateSuccessor}
        onRenewed={onRenewed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /renew this proof/i }));

    await waitFor(() => {
      expect(screen.getByText(/same proof type/i)).toBeInTheDocument();
    });
    expect(onRenewed).not.toHaveBeenCalled();
  });

  it("shows an already-renewed message and hides the Renew button once a successor exists (duplicate-submission prevention)", () => {
    const proof = makeProof();
    recordRenewal(USER_ID, proof.id, "proof-2");

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={jest.fn()}
        onRenewed={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: /renew this proof/i })).not.toBeInTheDocument();
    expect(screen.getByText(/already renewed/i)).toBeInTheDocument();
  });

  it("surfaces cancellation/failure from onCreateSuccessor as an error, without crashing (cancellation case)", async () => {
    const proof = makeProof();
    const onCreateSuccessor = jest.fn().mockRejectedValue(new Error("User cancelled signing"));

    render(
      <ProofRenewalAction
        userId={USER_ID}
        predecessor={proof}
        callerIssuerId={ISSUER_ID}
        onCreateSuccessor={onCreateSuccessor}
        onRenewed={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /renew this proof/i }));

    await waitFor(() => {
      expect(screen.getByText("User cancelled signing")).toBeInTheDocument();
    });
  });
});
