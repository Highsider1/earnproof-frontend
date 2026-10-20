/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { DeploymentMetadataWarning } from "../deployment-metadata-warning";
import type { DeploymentMetadataDocument } from "@/lib/deployment/deployment-metadata";

const BASE_METADATA: DeploymentMetadataDocument = {
  networkPassphrase: "Test SDF Network ; September 2015",
  contractAddresses: ["CONTRACTA"],
  artifactVersion: "1.2.3",
  issuedAt: new Date().toISOString(),
  signature: "sig",
};

describe("DeploymentMetadataWarning", () => {
  it("renders nothing for a 'valid' state", () => {
    const { container } = render(
      <DeploymentMetadataWarning state={{ status: "valid", metadata: BASE_METADATA }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an alert for 'unavailable', including the reason", () => {
    render(
      <DeploymentMetadataWarning
        state={{ status: "unavailable", reason: "network error" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/network error/);
  });

  it("renders an alert for 'malformed', including the reason", () => {
    render(
      <DeploymentMetadataWarning
        state={{ status: "malformed", reason: "signature invalid" }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/signature invalid/);
  });

  it("renders an alert for 'stale'", () => {
    render(
      <DeploymentMetadataWarning
        state={{ status: "stale", metadata: BASE_METADATA, ageMs: 999999 }}
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/out of date/i);
  });

  it("renders an alert for 'mismatched', naming every mismatched field", () => {
    render(
      <DeploymentMetadataWarning
        state={{
          status: "mismatched",
          metadata: BASE_METADATA,
          mismatches: [
            { field: "networkPassphrase", expected: "a", actual: "b" },
            { field: "artifactVersion", expected: "1.0.0", actual: "1.2.3" },
          ],
        }}
      />,
    );
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent(/networkPassphrase/);
    expect(alert).toHaveTextContent(/artifactVersion/);
  });
});
