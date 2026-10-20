/**
 * @jest-environment jsdom
 */
import { createAuthChallenge, verifyAuthChallenge } from "../auth";
import { apiClient } from "../client";

jest.mock("../client", () => ({
  ...jest.requireActual("../client"),
  apiClient: jest.fn(),
}));
const mockApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

beforeEach(() => {
  mockApiClient.mockReset();
});

describe("createAuthChallenge", () => {
  it("posts to /auth/challenge with the wallet address", async () => {
    mockApiClient.mockResolvedValue({
      id: "c1",
      message: "sign this",
      expiresAt: "2026-01-01T00:05:00.000Z",
    });

    const controller = new AbortController();
    const result = await createAuthChallenge("GWALLET", controller.signal);

    expect(mockApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/auth/challenge",
        method: "POST",
        body: JSON.stringify({ walletAddress: "GWALLET" }),
      }),
    );
    expect(result.id).toBe("c1");
  });
});

describe("verifyAuthChallenge", () => {
  it("posts to /auth/verify with the challenge id, wallet address, and signature", async () => {
    mockApiClient.mockResolvedValue({
      user: { id: "u1", walletAddress: "GWALLET", role: "MEMBER" },
      session: { token: "tok", tokenType: "Bearer" },
    });

    const controller = new AbortController();
    const result = await verifyAuthChallenge(
      { challengeId: "c1", walletAddress: "GWALLET", signature: "sig" },
      controller.signal,
    );

    expect(mockApiClient).toHaveBeenCalledWith(
      expect.objectContaining({
        path: "/auth/verify",
        method: "POST",
        body: JSON.stringify({
          challengeId: "c1",
          walletAddress: "GWALLET",
          signature: "sig",
        }),
      }),
    );
    expect(result.session.token).toBe("tok");
  });
});
