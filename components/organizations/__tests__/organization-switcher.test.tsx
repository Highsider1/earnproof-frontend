/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrganizationContextProvider } from "@/lib/organization-context/context";
import { OrganizationSwitcher } from "../organization-switcher";
import type { Organization } from "@/lib/api/generated/v1";

const ORGS: Organization[] = [
  { id: "org-1", name: "Acme Corp", slug: "acme", status: "ACTIVE" },
  { id: "org-2", name: "Old Co", slug: "old-co", status: "REVOKED" },
];

function renderSwitcher(initialOrganizationId: string | null = null) {
  return render(
    <OrganizationContextProvider initialOrganizationId={initialOrganizationId}>
      <OrganizationSwitcher organizations={ORGS} />
    </OrganizationContextProvider>,
  );
}

describe("OrganizationSwitcher", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("lists all organizations", () => {
    renderSwitcher();
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText(/Old Co \(unavailable\)/i)).toBeInTheDocument();
  });

  it("disables the option for an archived organization", () => {
    renderSwitcher();
    const option = screen.getByRole("option", { name: /Old Co/i }) as HTMLOptionElement;
    expect(option.disabled).toBe(true);
  });

  it("switches to a selectable organization", async () => {
    renderSwitcher();

    fireEvent.change(screen.getByLabelText("Organization"), { target: { value: "org-1" } });

    await waitFor(() => {
      expect(screen.getByLabelText("Organization")).toHaveValue("org-1");
    });
  });

  it("starts with the initial organization id already selected", () => {
    renderSwitcher("org-1");
    expect(screen.getByLabelText("Organization")).toHaveValue("org-1");
  });
});
