/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import { BatchProofRow, type BatchProofItem } from "../batch-proof-row";

const BASE_ITEM: BatchProofItem = {
  key: "item-1",
  raw: "proof-1",
  normalizedId: "proof-1",
  status: "pending",
};

describe("BatchProofRow", () => {
  it("shows the normalized identifier when available", () => {
    render(<BatchProofRow item={BASE_ITEM} />);
    expect(screen.getByText("proof-1")).toBeInTheDocument();
  });

  it("falls back to the raw value when there is no normalized id", () => {
    render(<BatchProofRow item={{ ...BASE_ITEM, normalizedId: null, raw: "bad input", status: "invalid" }} />);
    expect(screen.getByText("bad input")).toBeInTheDocument();
  });

  it("shows the verification result for a verified item", () => {
    render(
      <BatchProofRow item={{ ...BASE_ITEM, status: "verified", result: { result: "REVOKED", status: "revoked" } }} />,
    );
    expect(screen.getByText("REVOKED")).toBeInTheDocument();
  });

  it("never renders a claim field beyond the result enum", () => {
    render(
      <BatchProofRow
        item={{
          ...BASE_ITEM,
          status: "verified",
          result: {
            result: "VALID",
            status: "valid",
            credential: {
              id: "cred-1",
              schemaVersion: "1",
              subject: { walletHash: "wh_secret" },
              claim: {
                operator: "gte",
                thresholdAmount: "999999",
                assetCode: "USDC",
                assetIssuer: null,
                periodStart: "2026-01-01T00:00:00.000Z",
                periodEnd: "2026-01-31T00:00:00.000Z",
                qualifyingPaymentCount: 3,
              },
              privacy: { exactIncomeHidden: true, sourceTransactionsHidden: true },
              issuedAt: "2026-01-01T00:00:00.000Z",
              expiresAt: "2026-02-01T00:00:00.000Z",
              proof: { type: "MinimumIncomeProof", credentialHash: "hash", signature: "sig" },
            },
          },
        }}
      />,
    );

    expect(screen.queryByText("wh_secret")).not.toBeInTheDocument();
    expect(screen.queryByText("999999")).not.toBeInTheDocument();
  });
});
