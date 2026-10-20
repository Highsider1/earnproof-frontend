import { render, screen, fireEvent } from "@testing-library/react";
import { PurposeDeclaration } from "../purpose-declaration";
import {
  resolveDisclosure,
  validatePurposeDeclaration,
  isDeclarationExpired,
} from "@/lib/api/verification-purpose";

describe("PurposeDeclaration", () => {
  it("renders all approved purposes", () => {
    render(<PurposeDeclaration />);
    expect(screen.getByLabelText("Income verification")).toBeInDocument();
    expect(screen.getByLabelText("Tenancy screening")).toBeInDocument();
  });

  it("shows disclosure preview only for allowed fields", () => {
    render(
      <PurposeDeclaration
        requestedDisclosures={["threshold", "walletHash", "period"]}
      />,
    );
    fireEvent.click(screen.getByLabelText("Tenancy screening"));
    const preview = screen.getByTestId("disclosure-preview");
    expect(preview).toHaveTextContent("threshold");
    expect(preview).toHaveTextContent("period");
    expect(preview).not.toHaveTextContent("walletHash");
  });

  it("blocks submission without a purpose", () => {
    const onSubmit = jest.fn();
    render(<PurposeDeclaration onSubmit={onSubmit} /> );
    fireEvent.click(screen.getByText("Confirm purpose"));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/purpose_required/)).toBeInDocument();
  });

  it("submits a valid declaration", () => {
    const onSubmit = jest.fn();
    render(<PurposeDeclaration onSubmit={onSubmit} />);
    fireEvent.click(screen.getByLabelText("Income verification"));
    fireEvent.click(screen.getByText("Confirm purpose"));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0].purposeId).toBe("income-verification");
  });

  it("shows expired state and blocks submission", () => {
    const onSubmit = jest.fn();
    render(
      <PurposeDeclaration
        expiresAt="2026-01-01T00:00:00.000Z"
        now={new Date("2026-06-01T00:00:00.000Z")}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByTestId("purpose-expired")).toBeInDocument();
    fireEvent.click(screen.getByText("Confirm purpose"));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows denied state", () => {
    render(<PurposeDeclaration deniedReason="purpose_not_approved" />);
    expect(screen.getByTestId("purpose-denied")).toHaveTextContent(
      /Declaration denied: purpose_not_approved/,
    );
  });

  it("never exposes verifier identity in rendered output", () => {
    const { container } = render(<PurposeDeclaration />);
    expect(container.textContent).not.toMatch(/verifierId|verifierEmail|walletAddress/i);
  });
});

describe("resolveDisclosure", () => {
  it("never expands beyond the approved set", () => {
    expect(resolveDisclosure("tenancy-screening", ["threshold", "walletHash", "period"])).toEqual([
      "threshold",
      "period",
    ]);
  });

  it("returns empty for unknown purpose", () => {
    expect(resolveDisclosure("unknown", ["threshold"])).toEqual([]);
  });
});

describe("validatePurposeDeclaration", () => {
  it("flags missing purpose", () => {
    expect(validatePurposeDeclaration({ consentContext: "valid consent context" })).toContain(
      "purpose_required",
    );
  });

  it("flags unapproved purpose", () => {
    expect(
      validatePurposeDeclaration({ purposeId: "not-real", consentContext: "valid consent context" }),
    ).toContain("purpose_not_approved");
  });

  it("flags short consent context", () => {
    expect(
      validatePurposeDeclaration({ purposeId: "income-verification", consentContext: "short" }),
    ).toContain("consent_context_required");
  });
});

describe("isDeclarationExpired", () => {
  it("is deterministic at the exact expiry boundary", () => {
    expect(
      isDeclarationExpired("2026-01-01T00:00:00.000Z", new Date("2026-01-01T00:00:00.000Z")),
    ).toBe(true); // exact boundary is expired
  });

  it("treats invalid dates as expired", () => {
    expect(isDeclarationExpired("not-a-date")).toBe(true);
  });
});
