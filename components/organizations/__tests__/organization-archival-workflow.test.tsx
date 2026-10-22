/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrganizationArchivalWorkflow } from "../organization-archival-workflow";
import { performLifecycleAction } from "@/lib/api/organizations";
import type { Organization, Issuer } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/organizations", () => ({
  ...jest.requireActual("@/lib/api/organizations"),
  performLifecycleAction: jest.fn(),
}));

jest.mock("@stellar/freighter-api", () => ({
  requestAccess: jest.fn().mockResolvedValue({ address: "GABC123" }),
  getAddress: jest.fn().mockResolvedValue({ address: "GABC123" }),
}));

const mockedPerformLifecycleAction = performLifecycleAction as jest.MockedFunction<typeof performLifecycleAction>;

const ORG: Organization = {
  id: "org-1",
  name: "Acme Corp",
  slug: "acme-corp",
  status: "ACTIVE",
};

function activeIssuer(id: string): Issuer {
  return { id, name: `Issuer ${id}`, status: "ACTIVE", organizationId: "org-1" };
}

describe("OrganizationArchivalWorkflow", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockedPerformLifecycleAction.mockReset();
  });

  it("shows blocking active issuers and does not allow archiving", () => {
    render(
      <OrganizationArchivalWorkflow
        organization={ORG}
        issuers={[activeIssuer("issuer-1")]}
        token="tok"
        userId="user-1"
        onArchived={jest.fn()}
      />,
    );

    expect(screen.getByText(/Active resources must be resolved first/i)).toBeInTheDocument();
    expect(screen.getByText(/Active issuer: Issuer issuer-1/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeDisabled();
  });

  it("shows no-blockers message when there are no active issuers for this org", () => {
    render(
      <OrganizationArchivalWorkflow
        organization={ORG}
        issuers={[{ ...activeIssuer("issuer-2"), organizationId: "org-2" }]}
        token="tok"
        userId="user-1"
        onArchived={jest.fn()}
      />,
    );

    expect(screen.getByText(/No active resources are blocking archival/i)).toBeInTheDocument();
  });

  it("requests an export and shows its READY status with a retention deadline", () => {
    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));

    expect(screen.getByText("READY")).toBeInTheDocument();
    expect(screen.getByText(/Retention deadline/i)).toBeInTheDocument();
  });

  it("keeps the archive button disabled without a ready export", () => {
    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={jest.fn()} />,
    );

    expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeDisabled();
  });

  it("keeps the archive button disabled until the typed name matches exactly", () => {
    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: "Wrong Name" } });

    expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeDisabled();
  });

  it("requires re-authentication before archiving is enabled", () => {
    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: "Acme Corp" } });

    expect(screen.getByRole("button", { name: /Re-authenticate/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeDisabled();
  });

  it("enables archiving once export, confirmation, and reauth are all satisfied", async () => {
    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={jest.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: "Acme Corp" } });
    fireEvent.click(screen.getByRole("button", { name: /Re-authenticate/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeEnabled();
    });
  });

  it("calls onArchived with the updated organization on success", async () => {
    mockedPerformLifecycleAction.mockResolvedValue({ success: true, data: { ...ORG, status: "REVOKED" } });
    const onArchived = jest.fn();

    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={onArchived} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: "Acme Corp" } });
    fireEvent.click(screen.getByRole("button", { name: /Re-authenticate/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Archive Organization/i }));

    await waitFor(() => expect(onArchived).toHaveBeenCalledWith({ ...ORG, status: "REVOKED" }));
  });

  it("shows an error and does not call onArchived when the transition fails", async () => {
    mockedPerformLifecycleAction.mockResolvedValue({
      success: false,
      error: { message: "Conflict", type: "conflict", fieldErrors: {}, isRetryable: true },
    });
    const onArchived = jest.fn();

    render(
      <OrganizationArchivalWorkflow organization={ORG} issuers={[]} token="tok" userId="user-1" onArchived={onArchived} />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Request export/i }));
    fireEvent.change(screen.getByLabelText(/Type/i), { target: { value: "Acme Corp" } });
    fireEvent.click(screen.getByRole("button", { name: /Re-authenticate/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /Archive Organization/i })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: /Archive Organization/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Conflict"));
    expect(onArchived).not.toHaveBeenCalled();
  });
});
