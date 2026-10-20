import { render, screen } from "@testing-library/react";
import { ProofLineage } from "../proof-lineage";
import { recordRenewal } from "@/lib/proof-renewal/store";

const USER_ID = "user-1";

beforeEach(() => {
  window.localStorage.clear();
});

describe("ProofLineage", () => {
  it("renders nothing when the proof has no predecessor or successor", () => {
    const { container } = render(<ProofLineage userId={USER_ID} proofId="proof-1" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the successor link when the proof has been renewed", () => {
    recordRenewal(USER_ID, "proof-1", "proof-2");

    render(<ProofLineage userId={USER_ID} proofId="proof-1" />);

    expect(screen.getByText("Renewed into")).toBeInTheDocument();
    expect(screen.getByText("proof-2")).toBeInTheDocument();
    expect(screen.getByText("proof-2").closest("a")).toHaveAttribute(
      "href",
      "/proofs/verify?proof=proof-2",
    );
  });

  it("shows the predecessor link when the proof is itself a successor", () => {
    recordRenewal(USER_ID, "proof-1", "proof-2");

    render(<ProofLineage userId={USER_ID} proofId="proof-2" />);

    expect(screen.getByText("Renewed from")).toBeInTheDocument();
    expect(screen.getByText("proof-1")).toBeInTheDocument();
  });

  it("scopes lineage lookups per user", () => {
    recordRenewal("other-user", "proof-1", "proof-2");

    const { container } = render(<ProofLineage userId={USER_ID} proofId="proof-1" />);

    expect(container).toBeEmptyDOMElement();
  });
});
