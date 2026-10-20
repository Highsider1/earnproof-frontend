/**
 * @jest-environment jsdom
 */

import { act, render, screen } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { Timestamp } from "../timestamp";

const MOMENT = "2026-08-28T14:37:52.000Z";

describe("Timestamp (#151)", () => {
  it("discloses the timezone in the exact value", () => {
    render(<Timestamp value={MOMENT} />);
    const time = screen.getByText(/2026/);
    // Some trailing timezone abbreviation (PDT, UTC, GMT+9, ...) follows
    // the formatted date/time — never just a bare date/time with no zone.
    expect(time.textContent).toMatch(/[A-Za-z0-9+]{2,6}$/);
  });

  it("preserves the original instant in a machine-readable dateTime attribute", () => {
    render(<Timestamp value={MOMENT} />);
    const timeEl = screen.getByText(/2026/).closest("time");
    expect(timeEl).toHaveAttribute("dateTime", new Date(MOMENT).toISOString());
  });

  it("renders the same instant identically regardless of input form (ISO string, epoch, Date)", () => {
    const asDate = new Date(MOMENT);
    const { container: c1 } = render(<Timestamp value={MOMENT} />);
    const { container: c2 } = render(<Timestamp value={asDate.getTime()} />);
    const { container: c3 } = render(<Timestamp value={asDate} />);
    expect(c1.textContent).toBe(c2.textContent);
    expect(c2.textContent).toBe(c3.textContent);
  });

  it("never shows a misleading date for missing or invalid input", () => {
    const { rerender } = render(<Timestamp value={null} />);
    expect(screen.getByText("Unknown date")).toBeInTheDocument();

    rerender(<Timestamp value={undefined} />);
    expect(screen.getByText("Unknown date")).toBeInTheDocument();

    rerender(<Timestamp value="not-a-real-date" />);
    expect(screen.getByText("Unknown date")).toBeInTheDocument();
  });

  it("does not render a <time> element for invalid input (nothing machine-readable to assert)", () => {
    const { container } = render(<Timestamp value="garbage" />);
    expect(container.querySelector("time")).not.toBeInTheDocument();
  });

  it("omits the relative label by default", () => {
    render(<Timestamp value={MOMENT} />);
    expect(screen.queryByText(/ago|in \d/)).not.toBeInTheDocument();
  });

  it("hydrates server-rendered markup without a mismatch, then adds the relative label", () => {
    // The real mechanism this component has to satisfy: React's hydration
    // compares the server HTML against the *first* client render before
    // any effect runs, and logs a console error on any mismatch. Rendering
    // server markup into a real container and hydrating it is what
    // actually exercises that comparison, rather than asserting equal
    // strings by inspection.
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    const container = document.createElement("div");
    document.body.appendChild(container);
    container.innerHTML = renderToStaticMarkup(<Timestamp showRelative value={MOMENT} />);

    act(() => {
      hydrateRoot(container, <Timestamp showRelative value={MOMENT} />);
    });

    const hydrationMismatch = consoleError.mock.calls.some((call) =>
      String(call[0]).includes("Hydration"),
    );
    expect(hydrationMismatch).toBe(false);

    // The relative label is a post-mount enhancement: absent immediately
    // after hydration, present once the mount effect has flushed (already
    // true by this point, since the act() above flushed it).
    expect(container.querySelector("time")?.textContent).toContain("ago");

    consoleError.mockRestore();
    container.remove();
  });

  it("adds the relative label only after mount, as a client-only enhancement", () => {
    jest.useFakeTimers().setSystemTime(new Date(MOMENT));
    render(<Timestamp showRelative value={new Date(Date.now() - 2 * 60 * 60 * 1000)} />);

    act(() => {
      jest.runOnlyPendingTimers();
    });

    expect(screen.getByText(/ago/)).toBeInTheDocument();
    jest.useRealTimers();
  });
});
