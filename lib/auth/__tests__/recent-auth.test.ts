/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useRecentAuth, RECENT_AUTH_WINDOW_MS } from "../recent-auth";
import { apiClient } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  apiClient: jest.fn(),
}));

const mockApiClient = apiClient as jest.MockedFunction<typeof apiClient>;

const WALLET_A = "GAAA000000000000000000000000000000000000000000000000AAAA";
const WALLET_B = "GBBB000000000000000000000000000000000000000000000000BBBB";

function makeChallenge(overrides: Partial<{ expiresAt: string }> = {}) {
  return {
    id: "challenge-1",
    message: "sign this to confirm",
    expiresAt: overrides.expiresAt ?? new Date(Date.now() + 60_000).toISOString(),
  };
}

describe("useRecentAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("success: runs the action once the challenge is signed and verified", async () => {
    const action = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient
      .mockResolvedValueOnce(makeChallenge())
      .mockResolvedValueOnce({ user: {}, session: { token: "t", tokenType: "Bearer" } });

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(action);
    });

    expect(result.current.isPromptOpen).toBe(true);
    await waitFor(() => expect(result.current.challenge).not.toBeNull());

    await act(async () => {
      await result.current.confirmRecentAuth();
    });

    expect(signMessage).toHaveBeenCalledWith("sign this to confirm");
    expect(mockApiClient).toHaveBeenNthCalledWith(2, {
      path: "/auth/verify",
      method: "POST",
      body: JSON.stringify({
        challengeId: "challenge-1",
        walletAddress: WALLET_A,
        signature: "sig-abc",
      }),
    });
    expect(action).toHaveBeenCalledTimes(1);
    expect(result.current.isPromptOpen).toBe(false);
  });

  it("success: does not re-prompt for a second action within the freshness window", async () => {
    const firstAction = jest.fn();
    const secondAction = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient
      .mockResolvedValueOnce(makeChallenge())
      .mockResolvedValueOnce({ user: {}, session: { token: "t", tokenType: "Bearer" } });

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(firstAction);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());
    await act(async () => {
      await result.current.confirmRecentAuth();
    });
    expect(firstAction).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.requestRecentAuth(secondAction);
    });

    // No new prompt, no new network calls: the second action ran immediately.
    expect(result.current.isPromptOpen).toBe(false);
    expect(secondAction).toHaveBeenCalledTimes(1);
    expect(mockApiClient).toHaveBeenCalledTimes(2);
  });

  it("timeout: rejects confirming against a challenge that has since expired", async () => {
    const action = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient.mockResolvedValueOnce(
      makeChallenge({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    );

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(action);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());

    await act(async () => {
      await result.current.confirmRecentAuth();
    });

    expect(signMessage).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/expired/i);
  });

  it("account switch: refuses to run the action if the wallet address changed before confirming", async () => {
    const action = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient.mockResolvedValueOnce(makeChallenge());

    const { result, rerender } = renderHook(
      ({ walletAddress }) => useRecentAuth({ walletAddress, signMessage }),
      { initialProps: { walletAddress: WALLET_A } },
    );

    act(() => {
      result.current.requestRecentAuth(action);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());

    // Account switched in the wallet while the prompt was open.
    rerender({ walletAddress: WALLET_B });

    await act(async () => {
      await result.current.confirmRecentAuth();
    });

    expect(signMessage).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
    expect(result.current.error).toMatch(/wallet changed/i);
  });

  it("replay: a failed verify (stale/reused challenge) surfaces an error and never runs the action", async () => {
    const action = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient
      .mockResolvedValueOnce(makeChallenge())
      .mockRejectedValueOnce(new Error("Challenge already used"));

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(action);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());

    await act(async () => {
      await result.current.confirmRecentAuth();
    });

    expect(action).not.toHaveBeenCalled();
    expect(result.current.status).toBe("error");
  });

  it("cancel: discards the pending action without running it", async () => {
    const action = jest.fn();
    const signMessage = jest.fn();
    mockApiClient.mockResolvedValueOnce(makeChallenge());

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(action);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());

    act(() => {
      result.current.cancelRecentAuth();
    });

    expect(result.current.isPromptOpen).toBe(false);
    expect(result.current.challenge).toBeNull();
    expect(signMessage).not.toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("does not require reauth again for an action requested just under the freshness window, but does once it elapses", async () => {
    jest.useFakeTimers({ advanceTimers: true });
    const firstAction = jest.fn();
    const secondAction = jest.fn();
    const signMessage = jest.fn().mockResolvedValue("sig-abc");
    mockApiClient
      .mockResolvedValueOnce(makeChallenge())
      .mockResolvedValueOnce({ user: {}, session: { token: "t", tokenType: "Bearer" } })
      .mockResolvedValueOnce(makeChallenge());

    const { result } = renderHook(() =>
      useRecentAuth({ walletAddress: WALLET_A, signMessage }),
    );

    act(() => {
      result.current.requestRecentAuth(firstAction);
    });
    await waitFor(() => expect(result.current.challenge).not.toBeNull());
    await act(async () => {
      await result.current.confirmRecentAuth();
    });
    expect(firstAction).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(RECENT_AUTH_WINDOW_MS + 1);
    });

    act(() => {
      result.current.requestRecentAuth(secondAction);
    });

    // The freshness window elapsed: a new prompt is required, so the second
    // action does not run yet.
    expect(secondAction).not.toHaveBeenCalled();
    expect(result.current.isPromptOpen).toBe(true);

    jest.useRealTimers();
  });
});
