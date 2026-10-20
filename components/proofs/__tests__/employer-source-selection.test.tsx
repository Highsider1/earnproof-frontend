/**
 * @jest-environment jsdom
 */

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EmployerSourceSelection } from "../employer-source-selection";
import type { EmployerSource } from "@/lib/api/employer-payment-proofs";

function source(overrides: Partial<EmployerSource> = {}): EmployerSource {
  return {
    sourceAddress: "GSOURCE1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    trust: "TRUSTED",
    paymentCount: 3,
    assetCodes: ["USDC"],
    firstPaymentAt: "2026-01-05T00:00:00.000Z",
    lastPaymentAt: "2026-01-25T00:00:00.000Z",
    ...overrides,
  };
}

describe("EmployerSourceSelection", () => {
  const noop = () => undefined;

  it("explains a no-match state when there are no trusted sources", () => {
    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={noop}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[]}
      />
    );

    expect(screen.getByText(/no eligible, trusted employer sources were found/i)).toBeInTheDocument();
  });

  it("explains a multiple-match state and lists every trusted candidate", () => {
    const sources = [
      source({ sourceAddress: "GSOURCE1AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }),
      source({ sourceAddress: "GSOURCE2BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB" }),
    ];

    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={noop}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={sources}
      />
    );

    expect(screen.getByText(/2 eligible employer sources were found/i)).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
  });

  it("renders a single trusted match without the ambiguity banner", () => {
    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={noop}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[source()]}
      />
    );

    expect(screen.queryByText(/eligible employer sources were found/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no eligible/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(1);
  });

  it("lists untrusted/revoked sources as explicitly not selectable", () => {
    const untrusted = source({
      sourceAddress: "GREVOKEDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      trust: "UNTRUSTED",
    });

    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={noop}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[untrusted]}
      />
    );

    expect(screen.getByText(/untrusted or ineligible sources/i)).toBeInTheDocument();
    const radio = screen.getByRole("radio");
    expect(radio).toBeDisabled();
  });

  it("does not call onSourceSelect for an untrusted source even if clicked", async () => {
    const user = userEvent.setup();
    const onSourceSelect = jest.fn();
    const untrusted = source({ trust: "UNTRUSTED" });

    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={onSourceSelect}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[untrusted]}
      />
    );

    const radio = screen.getByRole("radio");
    await user.click(radio).catch(() => undefined);
    expect(onSourceSelect).not.toHaveBeenCalled();
  });

  it("calls onSourceSelect when a trusted source is chosen", async () => {
    const user = userEvent.setup();
    const onSourceSelect = jest.fn();

    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={onSourceSelect}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[source()]}
      />
    );

    await user.click(screen.getByRole("radio"));
    expect(onSourceSelect).toHaveBeenCalledWith(source().sourceAddress);
  });

  it("never renders individual payment amounts", () => {
    render(
      <EmployerSourceSelection
        loading={false}
        onRefreshPayments={noop}
        onSourceSelect={noop}
        onSyncPayments={noop}
        selectedSourceAddress={null}
        sources={[source()]}
      />
    );

    expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument(); // payment count only
  });
});
