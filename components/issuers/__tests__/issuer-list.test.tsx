/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssuerList } from "../issuer-list";
import { updateIssuer } from "@/lib/api/issuers";
import type { Issuer, Organization } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/issuers", () => ({
  ...jest.requireActual("@/lib/api/issuers"),
  updateIssuer: jest.fn(),
}));

const mockedUpdateIssuer = updateIssuer as jest.MockedFunction<typeof updateIssuer>;

const ACTIVE_ISSUER: Issuer = {
  id: "issuer-1",
  name: "Veridatum Labs",
  status: "ACTIVE",
  organizationId: undefined,
};

const PENDING_ISSUER: Issuer = {
  id: "issuer-2",
  name: "Pending Co",
  status: "PENDING",
  organizationId: undefined,
};

const ORGANIZATIONS: Organization[] = [
  { id: "org-1", name: "Acme Org", slug: "acme", status: "ACTIVE" },
];

describe("IssuerList role-gated transitions (#141)", () => {
  beforeEach(() => {
    mockedUpdateIssuer.mockReset();
  });

  it("offers every transition to an ADMIN", () => {
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Revoke" })).toBeInTheDocument();
  });

  it("does not offer Revoke to an ISSUER-role viewer", () => {
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ISSUER"
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Suspend" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("offers no status-transition actions to a WORKER-role viewer", () => {
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="WORKER"
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Activate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
    // Edit remains available regardless of transition permissions; it is
    // a metadata edit, not a status transition.
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("shows the contract sync action as disabled for every role, since no sync endpoint exists yet", () => {
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Sync contract" })).toBeDisabled();
  });

  it("offers no status-transition actions when role is undefined", () => {
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role={undefined}
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke" })).not.toBeInTheDocument();
  });

  it("only offers Activate (not Suspend or Revoke) for a PENDING issuer, even for an ADMIN", () => {
    render(
      <IssuerList
        issuers={[PENDING_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Activate" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suspend" })).not.toBeInTheDocument();
  });

  it("still requires confirmation before revoking, even for an ADMIN", async () => {
    const user = userEvent.setup();
    mockedUpdateIssuer.mockResolvedValue({ ...ACTIVE_ISSUER, status: "REVOKED" });

    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Revoke" }));
    expect(mockedUpdateIssuer).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });
});

describe("IssuerList metadata editing (#141)", () => {
  beforeEach(() => {
    mockedUpdateIssuer.mockReset();
  });

  it("opens an edit form pre-filled with the issuer's current name when Edit is clicked", async () => {
    const user = userEvent.setup();
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));

    const nameInput = screen.getByLabelText("Issuer Name") as HTMLInputElement;
    expect(nameInput.value).toBe("Veridatum Labs");
  });

  it("submits the updated name and organization, then closes the form", async () => {
    const user = userEvent.setup();
    const onIssuerUpdated = jest.fn();
    mockedUpdateIssuer.mockResolvedValue({
      ...ACTIVE_ISSUER,
      name: "Veridatum Labs Renamed",
      organizationId: "org-1",
    });

    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={onIssuerUpdated}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Issuer Name"));
    await user.type(screen.getByLabelText("Issuer Name"), "Veridatum Labs Renamed");
    await user.selectOptions(screen.getByLabelText("Organization"), "org-1");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => {
      expect(mockedUpdateIssuer).toHaveBeenCalledWith(
        "token",
        "issuer-1",
        { name: "Veridatum Labs Renamed", organizationId: "org-1" },
        expect.any(AbortSignal),
      );
    });
    expect(onIssuerUpdated).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Veridatum Labs Renamed" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
    });
  });

  it("rejects a name shorter than the minimum length before calling the API", async () => {
    const user = userEvent.setup();
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.clear(screen.getByLabelText("Issuer Name"));
    await user.type(screen.getByLabelText("Issuer Name"), "A");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Name must be at least 2 characters",
    );
    expect(mockedUpdateIssuer).not.toHaveBeenCalled();
  });

  it("cancels the edit without calling the API", async () => {
    const user = userEvent.setup();
    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByLabelText("Issuer Name")).not.toBeInTheDocument();
    expect(mockedUpdateIssuer).not.toHaveBeenCalled();
  });

  it("shows an error and keeps the form open when the update fails", async () => {
    const user = userEvent.setup();
    mockedUpdateIssuer.mockRejectedValue(new Error("Issuer name already in use"));

    render(
      <IssuerList
        issuers={[ACTIVE_ISSUER]}
        organizations={ORGANIZATIONS}
        loading={false}
        token="token"
        role="ADMIN"
        onIssuerUpdated={jest.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit" }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Issuer name already in use");
    expect(screen.getByLabelText("Issuer Name")).toBeInTheDocument();
  });
});
