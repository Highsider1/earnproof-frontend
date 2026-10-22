/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent } from "@testing-library/react";
import { OrganizationList } from "../organization-list";
import { updateOrganization } from "@/lib/api/organizations";
import type { Organization } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/organizations", () => {
  const actual = jest.requireActual("@/lib/api/organizations");
  return {
    ...actual,
    updateOrganization: jest.fn(),
  };
});

const mockedUpdateOrganization = updateOrganization as jest.Mock;

function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    name: "Acme",
    slug: "acme",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("OrganizationList", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders a semantic table with a column header for each field", () => {
    render(
      <OrganizationList
        organizations={[makeOrganization()]}
        loading={false}
        token="token"
        onOrganizationUpdated={jest.fn()}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /organization/i })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: /status/i })).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: /acme/i })).toBeInTheDocument();
  });

  it("renders an accessible empty state row when there are no organizations", () => {
    render(
      <OrganizationList
        organizations={[]}
        loading={false}
        token="token"
        onOrganizationUpdated={jest.fn()}
      />
    );

    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(
      screen.getByText(/no organizations found/i)
    ).toBeInTheDocument();
  });

  it("sorts rows by name when the Organization header is activated", () => {
    render(
      <OrganizationList
        organizations={[
          makeOrganization({ id: "1", name: "Zebra" }),
          makeOrganization({ id: "2", name: "Alpha" }),
        ]}
        loading={false}
        token="token"
        onOrganizationUpdated={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /organization/i }));

    const rows = screen.getAllByRole("row").slice(1); // skip header row
    expect(rows[0]).toHaveTextContent("Alpha");
    expect(rows[1]).toHaveTextContent("Zebra");
  });

  it("suspends an active organization after confirmation", async () => {
    mockedUpdateOrganization.mockResolvedValue(
      makeOrganization({ status: "SUSPENDED" })
    );
    const onOrganizationUpdated = jest.fn();

    render(
      <OrganizationList
        organizations={[makeOrganization()]}
        loading={false}
        token="token"
        onOrganizationUpdated={onOrganizationUpdated}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    const [, confirmButton] = screen.getAllByRole("button", { name: "Suspend" });
    fireEvent.click(confirmButton);

    expect(mockedUpdateOrganization).toHaveBeenCalledWith(
      "token",
      "org-1",
      { status: "SUSPENDED" },
      expect.any(AbortSignal)
    );
  });
});
