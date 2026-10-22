import { apiClient } from "@/lib/api/client";
import {
  EMBED_WIDGET_VERSION,
  fetchWidgetVerification,
  isSupportedEmbedWidgetVersion,
  SUPPORTED_EMBED_WIDGET_VERSIONS,
} from "@/lib/api/verification-widget";
import type { VerifyProofResponse } from "@/lib/api/generated/v1";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
}));

const mockedApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

const VALID_RESULT: VerifyProofResponse = {
  result: "VALID",
  status: "valid",
  credential: {
    id: "cred-1",
    schemaVersion: "1",
    subject: { walletHash: "wh_abc" },
    claim: {
      operator: "gte",
      thresholdAmount: "100",
      assetCode: "USDC",
      assetIssuer: null,
      periodStart: "2026-08-01T00:00:00.000Z",
      periodEnd: "2026-08-31T23:59:59.000Z",
      qualifyingPaymentCount: 3,
    },
    privacy: { exactIncomeHidden: true, sourceTransactionsHidden: true },
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    proof: { type: "MinimumIncomeProof", credentialHash: "hash_1", signature: "sig_1" },
  },
  proof: {
    id: "EP-8A42-91DC",
    type: "MinimumIncomeProof",
    schemaVersion: "1",
    network: "Stellar Testnet",
    issuedAt: "2026-08-01T00:00:00.000Z",
    expiresAt: "2026-09-01T00:00:00.000Z",
    revokedAt: null,
  },
};

describe("fetchWidgetVerification", () => {
  beforeEach(() => {
    mockedApiClient.mockReset();
  });

  it("rejects an identifier that fails the shared proof-id allow-list without calling the API", async () => {
    const state = await fetchWidgetVerification("<script>alert(1)</script>");

    expect(state).toEqual({ kind: "invalid-id" });
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("rejects an empty/whitespace-only identifier without calling the API", async () => {
    expect(await fetchWidgetVerification("")).toEqual({ kind: "invalid-id" });
    expect(await fetchWidgetVerification("   ")).toEqual({ kind: "invalid-id" });
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("rejects a javascript: URL disguised as a proof id without calling the API", async () => {
    const state = await fetchWidgetVerification("javascript:alert(1)");
    expect(state).toEqual({ kind: "invalid-id" });
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("rejects an identifier that exceeds the shared max length", async () => {
    const tooLong = "A".repeat(65);
    const state = await fetchWidgetVerification(tooLong);
    expect(state).toEqual({ kind: "invalid-id" });
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("calls the real verify endpoint with no Authorization header for a valid identifier", async () => {
    mockedApiClient.mockResolvedValue(VALID_RESULT);

    const state = await fetchWidgetVerification("EP-8A42-91DC");

    expect(state).toEqual({ kind: "result", response: VALID_RESULT });
    expect(mockedApiClient).toHaveBeenCalledTimes(1);
    const call = mockedApiClient.mock.calls[0][0];
    expect(call.path).toBe("/proofs/EP-8A42-91DC/verify");
    expect(call.method).toBe("GET");
    expect(call.headers).toBeUndefined();
  });

  it("trims surrounding whitespace before validating/encoding the identifier", async () => {
    mockedApiClient.mockResolvedValue(VALID_RESULT);

    await fetchWidgetVerification("  EP-8A42-91DC  ");

    expect(mockedApiClient.mock.calls[0][0].path).toBe("/proofs/EP-8A42-91DC/verify");
  });

  it("URL-encodes the identifier before interpolating it into the request path", async () => {
    mockedApiClient.mockResolvedValue(VALID_RESULT);

    // "a:b" passes RAW_PROOF_ID_PATTERN (colon is an allowed separator) but
    // must still be percent-encoded in the path.
    await fetchWidgetVerification("a:b");

    expect(mockedApiClient.mock.calls[0][0].path).toBe("/proofs/a%3Ab/verify");
  });

  it("resolves to 'unavailable' (never throws) when the API call rejects", async () => {
    mockedApiClient.mockRejectedValue(new Error("EarnProof API request failed with 500"));

    const state = await fetchWidgetVerification("EP-8A42-91DC");

    expect(state).toEqual({ kind: "unavailable" });
  });

  it("resolves to 'unavailable' on a network-level failure (TypeError from fetch)", async () => {
    mockedApiClient.mockRejectedValue(new TypeError("Failed to fetch"));

    const state = await fetchWidgetVerification("EP-8A42-91DC");

    expect(state).toEqual({ kind: "unavailable" });
  });

  it("forwards an AbortSignal so an in-flight request can be cancelled", async () => {
    mockedApiClient.mockResolvedValue(VALID_RESULT);
    const controller = new AbortController();

    await fetchWidgetVerification("EP-8A42-91DC", { signal: controller.signal });

    expect(mockedApiClient.mock.calls[0][0].signal).toBe(controller.signal);
  });
});

describe("embed widget versioning", () => {
  it("exposes exactly one supported version today, matching the route segment (/embed/v1/...)", () => {
    expect(EMBED_WIDGET_VERSION).toBe(1);
    expect(SUPPORTED_EMBED_WIDGET_VERSIONS).toEqual([1]);
  });

  it("recognizes the current version string and rejects anything else", () => {
    expect(isSupportedEmbedWidgetVersion("1")).toBe(true);
    expect(isSupportedEmbedWidgetVersion("2")).toBe(false);
    expect(isSupportedEmbedWidgetVersion("v1")).toBe(false);
    expect(isSupportedEmbedWidgetVersion("")).toBe(false);
    expect(isSupportedEmbedWidgetVersion("01")).toBe(false);
  });
});
