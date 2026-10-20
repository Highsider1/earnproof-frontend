/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { UnknownActivityEvent } from "../unknown-event";
import type { ActivityEvent } from "@/lib/api/activity";

describe("UnknownActivityEvent", () => {
  it("renders a safe fallback without crashing for an unrecognized event shape", () => {
    const event = {
      id: "evt_future",
      category: "future-category",
      secretApiKey: "sk_live_do_not_leak_me",
      rawWalletAddress: "GFULLWALLETADDRESSTHATSHOULDNEVERAPPEAR",
    } as unknown as ActivityEvent;

    render(<UnknownActivityEvent event={event} />);

    expect(screen.getByText("Unrecognized activity event")).toBeInTheDocument();
  });

  it("never renders unredacted/unknown raw fields from the event", () => {
    const event = {
      id: "evt_future",
      category: "future-category",
      secretApiKey: "sk_live_do_not_leak_me",
      rawWalletAddress: "GFULLWALLETADDRESSTHATSHOULDNEVERAPPEAR",
    } as unknown as ActivityEvent;

    render(<UnknownActivityEvent event={event} />);

    expect(screen.queryByText(/sk_live_do_not_leak_me/)).not.toBeInTheDocument();
    expect(screen.queryByText(/GFULLWALLETADDRESSTHATSHOULDNEVERAPPEAR/)).not.toBeInTheDocument();
  });

  it("shows a formatted timestamp when occurredAt is a valid string", () => {
    const event = {
      id: "evt_future",
      category: "future-category",
      occurredAt: "2026-01-01T00:00:00.000Z",
    } as unknown as ActivityEvent;

    render(<UnknownActivityEvent event={event} />);
    expect(screen.getByTestId("unknown-activity-event")).toHaveTextContent(/2026|1\/1\/2026|Jan/);
  });

  it("does not throw when occurredAt is missing or malformed", () => {
    const event = { id: "evt_future", category: "future-category" } as unknown as ActivityEvent;
    expect(() => render(<UnknownActivityEvent event={event} />)).not.toThrow();
  });
});
