/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { ProofLifecycleTimeline } from "../proof-lifecycle-timeline";

describe("ProofLifecycleTimeline (#137)", () => {
  it("renders Issued then Verified in order for a valid proof", () => {
    render(
      <ProofLifecycleTimeline
        proof={{ result: "VALID", issuedAt: "2026-08-01T00:00:00.000Z" }}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Issued");
    expect(items[1]).toHaveTextContent("Verified");
  });

  it("shows an explicit Revoked entry with visible text, not just a colored dot", () => {
    render(
      <ProofLifecycleTimeline
        proof={{
          result: "REVOKED",
          issuedAt: "2026-08-01T00:00:00.000Z",
          revokedAt: "2026-08-10T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(
      screen.getByText("The issuer revoked this proof before its natural expiration."),
    ).toBeInTheDocument();
  });

  it("shows an explicit Expired entry", () => {
    render(
      <ProofLifecycleTimeline
        proof={{
          result: "EXPIRED",
          issuedAt: "2026-08-01T00:00:00.000Z",
          expiresAt: "2026-09-01T00:00:00.000Z",
        }}
      />,
    );

    expect(screen.getByText("Expired")).toBeInTheDocument();
  });

  it("shows a pending/not-found state distinctly for an unknown proof", () => {
    render(<ProofLifecycleTimeline proof={{ result: "UNKNOWN_PROOF" }} />);
    expect(screen.getByText("Not found")).toBeInTheDocument();
  });

  it("shows a failed-verification state distinctly from expired/revoked", () => {
    render(
      <ProofLifecycleTimeline
        proof={{ result: "INVALID_SIGNATURE", issuedAt: "2026-08-01T00:00:00.000Z" }}
      />,
    );
    expect(screen.getByText("Verification failed")).toBeInTheDocument();
  });

  it("never renders sensitive claim values (income amounts, wallet hashes)", () => {
    const { container } = render(
      <ProofLifecycleTimeline
        proof={{ result: "VALID", issuedAt: "2026-08-01T00:00:00.000Z" }}
      />,
    );
    expect(container.textContent).not.toMatch(/wallet|threshold|income/i);
  });

  it("still shows a Verified entry for a valid proof with no issuedAt, rather than rendering nothing", () => {
    render(<ProofLifecycleTimeline proof={{ result: "VALID" }} />);
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.queryByText("Issued")).not.toBeInTheDocument();
  });
});
