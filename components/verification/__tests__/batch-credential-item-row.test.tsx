/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { BatchCredentialItemRow, type BatchItem } from "../batch-credential-item-row";

const BASE_ITEM: BatchItem = {
  key: "item-1",
  source: "manual",
  label: "Manual entry (cred-1)",
  credentialId: "cred-1",
  status: "pending",
};

describe("BatchCredentialItemRow", () => {
  it("shows the Pending label for a pending item", () => {
    render(<BatchCredentialItemRow item={BASE_ITEM} />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("shows a reject reason for a rejected item", () => {
    render(<BatchCredentialItemRow item={{ ...BASE_ITEM, status: "rejected", rejectReason: "Duplicate id" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Duplicate id");
  });

  it("shows the verification result for a verified item", () => {
    render(
      <BatchCredentialItemRow
        item={{ ...BASE_ITEM, status: "verified", result: { result: "REVOKED", status: "revoked" } }}
      />,
    );
    expect(screen.getByText("REVOKED")).toBeInTheDocument();
  });

  it("shows a generic failure message for a failed item", () => {
    render(<BatchCredentialItemRow item={{ ...BASE_ITEM, status: "failed" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent(/failed for this item/i);
  });

  it("shows Cancelled for a cancelled item", () => {
    render(<BatchCredentialItemRow item={{ ...BASE_ITEM, status: "cancelled" }} />);
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
