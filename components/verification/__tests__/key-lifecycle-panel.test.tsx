/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { KeyLifecyclePanel } from "../key-lifecycle-panel";
import type { KeyDiscoveryOutcome } from "@/lib/validation/key-lifecycle";

const ACTIVE_OUTCOME: KeyDiscoveryOutcome = {
  kind: "FOUND",
  key: {
    keyId: "key-2026-01",
    algorithm: "Ed25519",
    lifecycleState: "ACTIVE",
    trustSource: "EarnProof Issuer Registry",
    activatedAt: "2026-01-01T00:00:00.000Z",
    retiredAt: null,
  },
  discoveredAt: "2026-01-01T00:00:00.000Z",
  isStale: false,
};

describe("KeyLifecyclePanel", () => {
  it("renders key details for an active key", () => {
    render(<KeyLifecyclePanel outcome={ACTIVE_OUTCOME} />);

    expect(screen.getByText("key-2026-01")).toBeInTheDocument();
    expect(screen.getByText("Ed25519")).toBeInTheDocument();
    expect(screen.getByText("EarnProof Issuer Registry")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows the overlap rotation explanation for a rotating key", () => {
    render(
      <KeyLifecyclePanel
        outcome={{ ...ACTIVE_OUTCOME, key: { ...ACTIVE_OUTCOME.key, lifecycleState: "OVERLAP_ROTATION" } }}
      />,
    );

    expect(screen.getByText(/phased out in favor of a newer one/i)).toBeInTheDocument();
  });

  it("shows a retired date for a retired key", () => {
    render(
      <KeyLifecyclePanel
        outcome={{
          ...ACTIVE_OUTCOME,
          key: { ...ACTIVE_OUTCOME.key, lifecycleState: "RETIRED", retiredAt: "2026-06-01T00:00:00.000Z" },
        }}
      />,
    );

    expect(screen.getAllByText("Retired")).toHaveLength(2);
    expect(screen.getByText("Jun 1, 2026")).toBeInTheDocument();
  });

  it("shows a blocking message for an unknown lifecycle state", () => {
    render(
      <KeyLifecyclePanel outcome={{ ...ACTIVE_OUTCOME, key: { ...ACTIVE_OUTCOME.key, lifecycleState: "UNKNOWN" } }} />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/cannot confirm trust/i);
  });

  it("shows a stale warning when isStale is true", () => {
    render(<KeyLifecyclePanel outcome={{ ...ACTIVE_OUTCOME, isStale: true }} />);
    expect(screen.getByRole("status")).toHaveTextContent(/cached and may be out of date/i);
  });

  it("does not show a stale warning when isStale is false", () => {
    render(<KeyLifecyclePanel outcome={ACTIVE_OUTCOME} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a blocking message for UNKNOWN_KEY", () => {
    render(<KeyLifecyclePanel outcome={{ kind: "UNKNOWN_KEY" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/not recognized/i);
  });

  it("shows a blocking message for DISCOVERY_UNAVAILABLE", () => {
    render(<KeyLifecyclePanel outcome={{ kind: "DISCOVERY_UNAVAILABLE" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
  });
});
