import { render, screen } from "@testing-library/react";

import { InfoSection } from "@/components/common/info-section";
import { NetworkBadge } from "@/components/common/network-badge";
import { PageHeading } from "@/components/common/page-heading";

describe("shared common UI contracts", () => {
  it("renders PageHeading with its accessible heading semantics", () => {
    render(
      <PageHeading
        title="Proof verification"
        description="Verify a credential without exposing extra proof data."
      />,
    );

    expect(
      screen.getByRole("heading", {
        name: "Proof verification",
      }),
    ).toBeInTheDocument();
  });

  it("renders NetworkBadge with the supplied network label", () => {
    render(
      <NetworkBadge />,
    );

    expect(
      screen.getByText("Testnet"),
    ).toBeInTheDocument();
  });

  it("renders InfoSection content without relying on DOM order", () => {
    render(
      <InfoSection title="Proof details" items={["Verification information"]} />,
    );

    expect(
      screen.getByText("Proof details"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Verification information"),
    ).toBeInTheDocument();
  });
});
