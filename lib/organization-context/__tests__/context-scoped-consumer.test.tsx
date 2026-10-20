/**
 * @jest-environment jsdom
 */

import { render, screen, act, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";
import { OrganizationContextProvider, useOrganizationContext } from "../context";
import type { Organization } from "@/lib/api/generated/v1";

function org(id: string): Organization {
  return { id, name: id, slug: id, status: "ACTIVE" };
}

/**
 * Stand-in for any real organization-scoped component (a proof list, an
 * issuer list, an audit log). It fetches data keyed by
 * [organizationId, generation] and discards a response that resolves
 * after the organization has since changed again, demonstrating the
 * pattern every scoped consumer in the app is expected to follow (#179's
 * "switching clears stale proof, issuer, key, and audit data before
 * rendering" and "rapid switching" coverage).
 */
function ScopedConsumer({ fetchData }: { fetchData: (orgId: string) => Promise<string> }) {
  const { organizationId, generation } = useOrganizationContext();
  const [data, setData] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setData(null);
      return;
    }

    let active = true;
    setData(null);
    void fetchData(organizationId).then((result) => {
      if (active) {
        setData(result);
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, generation]);

  return <div data-testid="scoped-data">{data ?? "loading"}</div>;
}

describe("organization-scoped consumer reset on switch", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears displayed data immediately on switch, before the new fetch resolves", async () => {
    let resolveFirst!: (value: string) => void;
    let resolveSecond!: (value: string) => void;
    const fetchData = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSecond = resolve;
          }),
      );

    function Harness() {
      const { switchOrganization } = useOrganizationContext();
      return (
        <>
          <button onClick={() => void switchOrganization(org("org-1"))}>select org-1</button>
          <button onClick={() => void switchOrganization(org("org-2"))}>select org-2</button>
          <ScopedConsumer fetchData={fetchData} />
        </>
      );
    }

    render(
      <OrganizationContextProvider initialOrganizationId={null}>
        <Harness />
      </OrganizationContextProvider>,
    );

    await act(async () => {
      screen.getByText("select org-1").click();
    });
    expect(screen.getByTestId("scoped-data")).toHaveTextContent("loading");

    resolveFirst("org-1-data");
    await waitFor(() => expect(screen.getByTestId("scoped-data")).toHaveTextContent("org-1-data"));

    await act(async () => {
      screen.getByText("select org-2").click();
    });

    // Immediately after switching, the previous org's data must not still
    // be showing - it should be cleared even before org-2's fetch settles.
    expect(screen.getByTestId("scoped-data")).toHaveTextContent("loading");

    resolveSecond("org-2-data");
    await waitFor(() => expect(screen.getByTestId("scoped-data")).toHaveTextContent("org-2-data"));
  });

  it("discards a stale response from a fetch started before a rapid second switch", async () => {
    const deferred: Array<(value: string) => void> = [];
    const fetchData = jest.fn().mockImplementation(
      (orgId: string) =>
        new Promise<string>((resolve) => {
          deferred.push(() => resolve(`${orgId}-data`));
        }),
    );

    function Harness() {
      const { switchOrganization } = useOrganizationContext();
      return (
        <>
          <button onClick={() => void switchOrganization(org("org-a"))}>select a</button>
          <button onClick={() => void switchOrganization(org("org-b"))}>select b</button>
          <ScopedConsumer fetchData={fetchData} />
        </>
      );
    }

    render(
      <OrganizationContextProvider initialOrganizationId={null}>
        <Harness />
      </OrganizationContextProvider>,
    );

    await act(async () => {
      screen.getByText("select a").click();
    });
    await act(async () => {
      screen.getByText("select b").click();
    });

    // Resolve org-a's fetch last, after org-b is already selected: its
    // result must never overwrite org-b's display.
    act(() => {
      deferred[1]?.("org-b-data");
    });
    await waitFor(() => expect(screen.getByTestId("scoped-data")).toHaveTextContent("org-b-data"));

    act(() => {
      deferred[0]?.("org-a-data");
    });
    expect(screen.getByTestId("scoped-data")).toHaveTextContent("org-b-data");
  });

  it("clears data when the organization is removed (membership revoked mid-session)", async () => {
    const fetchData = jest.fn().mockResolvedValue("org-1-data");

    function Harness() {
      const { switchOrganization, clearOrganization } = useOrganizationContext();
      return (
        <>
          <button onClick={() => void switchOrganization(org("org-1"))}>select</button>
          <button onClick={() => clearOrganization()}>remove membership</button>
          <ScopedConsumer fetchData={fetchData} />
        </>
      );
    }

    render(
      <OrganizationContextProvider initialOrganizationId={null}>
        <Harness />
      </OrganizationContextProvider>,
    );

    await act(async () => {
      screen.getByText("select").click();
    });
    await waitFor(() => expect(screen.getByTestId("scoped-data")).toHaveTextContent("org-1-data"));

    act(() => {
      screen.getByText("remove membership").click();
    });

    expect(screen.getByTestId("scoped-data")).toHaveTextContent("loading");
  });
});
