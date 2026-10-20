/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateOrganizationForm } from "../create-organization-form";
import { createOrganization } from "@/lib/api/organizations";
import { readFormDraft } from "@/lib/forms/drafts";

jest.mock("@/lib/api/organizations", () => {
  const actual = jest.requireActual("@/lib/api/organizations");
  return {
    ...actual,
    createOrganization: jest.fn(),
  };
});

const mockedCreateOrganization = createOrganization as jest.Mock;

describe("CreateOrganizationForm unsaved-changes guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it("does not warn on beforeunload for a pristine form", () => {
    render(<CreateOrganizationForm token="t" onOrganizationCreated={jest.fn()} />);

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const spy = jest.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(spy).not.toHaveBeenCalled();
  });

  it("warns on beforeunload once the form has been edited", () => {
    render(<CreateOrganizationForm token="t" onOrganizationCreated={jest.fn()} />);

    fireEvent.change(screen.getByLabelText("Organization Name"), {
      target: { value: "Acme" },
    });

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    const spy = jest.spyOn(event, "preventDefault");
    window.dispatchEvent(event);

    expect(spy).toHaveBeenCalled();
  });

  it("clears any saved draft after a successful submission", async () => {
    mockedCreateOrganization.mockResolvedValue({
      id: "org-1",
      name: "Acme",
      slug: "acme",
      status: "ACTIVE",
    });
    const onOrganizationCreated = jest.fn();

    const user = userEvent.setup();
    render(<CreateOrganizationForm token="t" onOrganizationCreated={onOrganizationCreated} />);

    await user.type(screen.getByLabelText("Organization Name"), "Acme");
    await user.type(screen.getByLabelText("Slug"), "acme");
    await user.click(screen.getByRole("button", { name: /create organization/i }));

    await waitFor(() => expect(onOrganizationCreated).toHaveBeenCalled());
    expect(readFormDraft("create-organization-form")).toBeNull();
  });
});
