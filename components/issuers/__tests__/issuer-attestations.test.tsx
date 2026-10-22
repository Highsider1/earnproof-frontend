/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IssuerAttestations } from "../issuer-attestations";
import { apiClient } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
  bearer: (token: string) => ({ Authorization: `Bearer ${token}` }),
  retryRead: (fn: (signal: AbortSignal) => Promise<unknown>, signal: AbortSignal) => fn(signal),
  retryMutation: (fn: (signal: AbortSignal) => Promise<unknown>, signal: AbortSignal) => fn(signal),
}));

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

const VALID_HASH = `sha256:${"a".repeat(64)}`;

const ACTIVE_ATTESTATION = {
  id: "att-1",
  issuerId: "issuer-1",
  subjectWalletHash: VALID_HASH,
  type: "EMPLOYMENT" as const,
  status: "ACTIVE" as const,
  issuedAt: "2026-01-01T00:00:00.000Z",
  expiresAt: "2099-01-01T00:00:00.000Z",
  revokedAt: null,
};

const EXPIRED_ATTESTATION = {
  ...ACTIVE_ATTESTATION,
  id: "att-2",
  status: "ACTIVE" as const,
  expiresAt: "2020-01-01T00:00:00.000Z",
};

const REVOKED_ATTESTATION = {
  ...ACTIVE_ATTESTATION,
  id: "att-3",
  status: "REVOKED" as const,
  revokedAt: "2026-02-01T00:00:00.000Z",
};

function renderComponent(overrides: Partial<Parameters<typeof IssuerAttestations>[0]> = {}) {
  return render(
    <IssuerAttestations
      issuerId="issuer-1"
      issuerName="Veridatum Labs"
      issuerStatus="ACTIVE"
      viewerRole="ISSUER"
      token="test-token"
      {...overrides}
    />
  );
}

describe("IssuerAttestations", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("renders active, expired, and revoked attestations without exposing payloads", async () => {
    mockedApiClient.mockResolvedValueOnce([ACTIVE_ATTESTATION, EXPIRED_ATTESTATION, REVOKED_ATTESTATION]);

    renderComponent();

    await waitFor(() => {
      expect(screen.getAllByText(VALID_HASH)).toHaveLength(3);
    });
    const list = screen.getByRole("list");
    expect(within(list).getByText("Active")).toBeInTheDocument();
    expect(within(list).getByText("Expired")).toBeInTheDocument();
    expect(within(list).getByText("Revoked")).toBeInTheDocument();
    // No credential/signed-payload markup should appear on the list view.
    expect(screen.queryByText(/signed attestation payload/i)).not.toBeInTheDocument();
  });

  it("shows an explicit unavailable state on fetch failure, not an empty list", async () => {
    mockedApiClient.mockRejectedValueOnce(new Error("network error"));

    renderComponent();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(/unavailable/i);
    });
    expect(screen.queryByText(/no attestations yet/i)).not.toBeInTheDocument();
  });

  it("filters the list by status", async () => {
    const user = userEvent.setup();
    mockedApiClient.mockResolvedValueOnce([ACTIVE_ATTESTATION, REVOKED_ATTESTATION]);

    renderComponent();

    await waitFor(() => expect(screen.getAllByText(VALID_HASH)).toHaveLength(2));

    await user.click(screen.getByRole("button", { name: "Active" }));
    expect(screen.getAllByText(VALID_HASH)).toHaveLength(1);
    const list = screen.getByRole("list");
    expect(within(list).getByText("Active")).toBeInTheDocument();
    expect(within(list).queryByText("Revoked")).not.toBeInTheDocument();
  });

  describe("role denial", () => {
    it("blocks creation for a viewer without issuer/admin role and explains why", async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      renderComponent({ viewerRole: "WORKER" });

      await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());

      expect(screen.getByText(/requires issuer or administrator access/i)).toBeInTheDocument();
      const submitButton = screen.getByRole("button", { name: "Create" });
      expect(submitButton).toBeDisabled();
    });

    it("blocks creation when the issuer itself is not ACTIVE, even for an authorized role", async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      renderComponent({ issuerStatus: "SUSPENDED", viewerRole: "ISSUER" });

      await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());

      expect(screen.getByText(/only active issuers can create attestations/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    });

    it("does not call the create API when the fieldset is disabled for an unauthorized viewer", async () => {
      mockedApiClient.mockResolvedValueOnce([]);
      renderComponent({ viewerRole: "WORKER" });

      await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());

      const postCalls = mockedApiClient.mock.calls.filter(([opts]) => opts.method === "POST");
      expect(postCalls).toHaveLength(0);
    });
  });

  describe("invalid subjects", () => {
    it("rejects a malformed subject wallet hash client-side without calling the API", async () => {
      const user = userEvent.setup();
      mockedApiClient.mockResolvedValueOnce([]);
      renderComponent();

      await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());

      await user.type(screen.getByLabelText("Subject wallet hash"), "not-a-hash");
      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(await screen.findByText(/enter a valid wallet hash/i)).toBeInTheDocument();
      const postCalls = mockedApiClient.mock.calls.filter(([opts]) => opts.method === "POST");
      expect(postCalls).toHaveLength(0);
    });
  });

  describe("expiry", () => {
    it("shows an expired attestation as Expired even though the stored status is still ACTIVE", async () => {
      mockedApiClient.mockResolvedValueOnce([EXPIRED_ATTESTATION]);
      renderComponent();

      await waitFor(() => expect(within(screen.getByRole("list")).getByText("Expired")).toBeInTheDocument());
      // Revoke must be disabled for an expired (non-active) attestation.
      expect(screen.getByRole("button", { name: /revoke attestation/i })).toBeDisabled();
    });
  });

  describe("revocation", () => {
    it("revokes an active attestation after confirmation and refreshes eligibility", async () => {
      const user = userEvent.setup();
      const onEligibilityChanged = jest.fn();
      mockedApiClient
        .mockResolvedValueOnce([ACTIVE_ATTESTATION]) // initial load
        .mockResolvedValueOnce({ ...ACTIVE_ATTESTATION, status: "REVOKED", revokedAt: "2026-03-01T00:00:00.000Z" }); // revoke

      renderComponent({ onEligibilityChanged });

      await waitFor(() => expect(within(screen.getByRole("list")).getByText("Active")).toBeInTheDocument());

      await user.click(screen.getByRole("button", { name: /revoke attestation/i }));

      const dialog = await screen.findByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: "Revoke Attestation" }));

      await waitFor(() => {
        expect(within(screen.getByRole("list")).getByText("Revoked")).toBeInTheDocument();
      });
      expect(onEligibilityChanged).toHaveBeenCalled();

      const revokeCall = mockedApiClient.mock.calls.find(
        ([opts]) => typeof opts.path === "string" && opts.path.includes("/revoke")
      );
      expect(revokeCall?.[0].path).toBe("/issuers/issuer-1/attestations/att-1/revoke");
    });

    it("cannot revoke an attestation that is already revoked", async () => {
      mockedApiClient.mockResolvedValueOnce([REVOKED_ATTESTATION]);
      renderComponent();

      await waitFor(() => expect(within(screen.getByRole("list")).getByText("Revoked")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: /revoke attestation/i })).toBeDisabled();
    });
  });

  describe("privacy", () => {
    it("shows the one-time signed payload after creation but never persists it to storage", async () => {
      const user = userEvent.setup();
      const setItemSpy = jest.spyOn(window.localStorage.__proto__, "setItem");
      mockedApiClient
        .mockResolvedValueOnce([]) // initial load
        .mockResolvedValueOnce({
          attestation: ACTIVE_ATTESTATION,
          signedPayload: "one-time-signed-payload-data",
        }); // create

      renderComponent();

      await waitFor(() => expect(screen.getByText(/no attestations yet/i)).toBeInTheDocument());

      await user.type(screen.getByLabelText("Subject wallet hash"), VALID_HASH);
      await user.click(screen.getByRole("button", { name: "Create" }));

      expect(await screen.findByText("one-time-signed-payload-data")).toBeInTheDocument();
      expect(setItemSpy).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining("one-time-signed-payload-data")
      );

      setItemSpy.mockRestore();
    });
  });
});
