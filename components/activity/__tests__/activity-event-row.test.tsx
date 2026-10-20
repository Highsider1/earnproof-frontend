/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { ActivityEventRow } from "../activity-event-row";
import type {
  AdminActivityEvent,
  AuthActivityEvent,
  KeyActivityEvent,
  SessionActivityEvent,
} from "@/lib/api/activity";

describe("ActivityEventRow — known event categories", () => {
  it("renders an auth event", () => {
    const event: AuthActivityEvent = {
      id: "evt_1",
      category: "auth",
      action: "wallet-signature-verified",
      outcome: "success",
      occurredAt: new Date().toISOString(),
      walletAddressMasked: "GABC•••MNOP",
      ipAddressMasked: "203.0.113.0",
      locationLabel: "Lagos, NG",
    };

    render(<ActivityEventRow event={event} />);
    expect(screen.getByText(/signed in/)).toBeInTheDocument();
    expect(screen.getByText("success")).toBeInTheDocument();
    expect(screen.getByText(/Lagos, NG/)).toBeInTheDocument();
  });

  it("renders a key event", () => {
    const event: KeyActivityEvent = {
      id: "evt_2",
      category: "key",
      action: "api-key-revoked",
      outcome: "success",
      occurredAt: new Date().toISOString(),
      apiKeyIdMasked: "key_•••3210",
    };

    render(<ActivityEventRow event={event} />);
    expect(screen.getByText(/API key key_•••3210 revoked/)).toBeInTheDocument();
  });

  it("renders a session event", () => {
    const event: SessionActivityEvent = {
      id: "evt_3",
      category: "session",
      action: "session-expired",
      outcome: "pending",
      occurredAt: new Date().toISOString(),
      sessionIdMasked: "sess•••7089",
    };

    render(<ActivityEventRow event={event} />);
    expect(screen.getByText(/expired/)).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
  });

  it("renders an admin event", () => {
    const event: AdminActivityEvent = {
      id: "evt_4",
      category: "admin",
      action: "issuer-suspended",
      outcome: "failure",
      occurredAt: new Date().toISOString(),
      targetLabel: "Suspicious Issuer LLC",
    };

    render(<ActivityEventRow event={event} />);
    expect(screen.getByText(/Issuer suspended: Suspicious Issuer LLC/)).toBeInTheDocument();
    expect(screen.getByText("failure")).toBeInTheDocument();
  });

  it("falls back to the safe unknown-event renderer for an unrecognized category", () => {
    const event = { id: "evt_5", category: "mystery" } as unknown as AuthActivityEvent;
    render(<ActivityEventRow event={event} />);
    expect(screen.getByTestId("unknown-activity-event")).toBeInTheDocument();
  });
});
