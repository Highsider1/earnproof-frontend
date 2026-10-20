/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { CapabilityUnavailable } from "../capability-unavailable";

describe("CapabilityUnavailable", () => {
  it("renders default copy and a link back", () => {
    render(<CapabilityUnavailable />);
    expect(screen.getByText("This feature isn't available yet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to EarnProof" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders custom copy and destination when provided", () => {
    render(
      <CapabilityUnavailable
        title="Activity log unavailable"
        description="Not enabled for your organization yet."
        homeHref="/settings"
        homeLabel="Back to settings"
      />,
    );
    expect(screen.getByText("Activity log unavailable")).toBeInTheDocument();
    expect(screen.getByText("Not enabled for your organization yet.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
  });

  it("exposes the unavailable message as a status region for assistive tech", () => {
    render(<CapabilityUnavailable />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
