import { apiClient, retryMutation } from "./client";

export interface AuthChallenge {
  id: string;
  message: string;
  expiresAt: string;
}

export interface AuthVerifyResult {
  user: { id: string; walletAddress: string; role: string };
  session: { token: string; tokenType: "Bearer" };
}

export async function createAuthChallenge(
  walletAddress: string,
  signal: AbortSignal,
): Promise<AuthChallenge> {
  return retryMutation(async (signal) => {
    return apiClient<AuthChallenge>({
      path: "/auth/challenge",
      method: "POST",
      body: JSON.stringify({ walletAddress }),
      signal,
    });
  }, signal);
}

export async function verifyAuthChallenge(
  input: { challengeId: string; walletAddress: string; signature: string },
  signal: AbortSignal,
): Promise<AuthVerifyResult> {
  return retryMutation(async (signal) => {
    return apiClient<AuthVerifyResult>({
      path: "/auth/verify",
      method: "POST",
      body: JSON.stringify(input),
      signal,
    });
  }, signal);
}
