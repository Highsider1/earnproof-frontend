/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { PermissionReview } from "../permission-review";

describe("PermissionReview", () => {
  it("renders the key name and expiration", () => {
    render(
      <PermissionReview keyName="CI deploys" scopes={["proofs:read"]} expiresInDays={30} />,
    );
    expect(screen.getByText("CI deploys")).toBeInTheDocument();
    expect(screen.getByText("In 30 days")).toBeInTheDocument();
  });

  it("shows 'Never' for no expiration", () => {
    render(<PermissionReview keyName="CI deploys" scopes={["proofs:read"]} />);
    expect(screen.getByText("Never")).toBeInTheDocument();
  });

  it("renders a plain-language description per selected scope", () => {
    render(
      <PermissionReview
        keyName="CI deploys"
        scopes={["proofs:read", "verification:read"]}
      />,
    );
    expect(screen.getByText(/Read proof metadata and status/)).toBeInTheDocument();
    expect(
      screen.getByText(/Verify proof credentials and read verification status/),
    ).toBeInTheDocument();
  });

  it("shows nothing extra for a minimal, read-only scope set", () => {
    render(<PermissionReview keyName="CI deploys" scopes={["proofs:read"]} />);
    expect(screen.queryByText(/Broad/)).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("warns when a broad scope is selected", () => {
    render(<PermissionReview keyName="CI deploys" scopes={["webhooks:manage"]} />);
    const alerts = screen.getAllByRole("alert");
    expect(alerts.some((el) => /broad permission/i.test(el.textContent ?? ""))).toBe(true);
  });

  it("does not warn for a scope set with no broad scopes", () => {
    render(
      <PermissionReview keyName="CI deploys" scopes={["proofs:read", "verification:read"]} />,
    );
    expect(screen.queryByText(/broad permission/i)).not.toBeInTheDocument();
  });

  it("flags an unrecognized scope rather than silently including it", () => {
    render(<PermissionReview keyName="CI deploys" scopes={["proofs:read", "made-up-scope"]} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/not a recognized scope/);
    expect(screen.queryByText("made-up-scope")).not.toBeInTheDocument();
  });

  it("handles an empty scope set without crashing", () => {
    render(<PermissionReview keyName="CI deploys" scopes={[]} />);
    expect(screen.getByText("CI deploys")).toBeInTheDocument();
  });
});
