import { apiClient, bearer, retryRead } from "./client";
import type { VerifyProofResponse } from "./generated/v1";

export type { VerifyProofResponse };

/**
 * Statuses that can never change again once reached. A proof still `valid`
 * or `unknown` (pending anchoring) can transition later, so polling must
 * continue for those; `expired`/`revoked`/`invalid` never reverse (#154).
 */
export const TERMINAL_PROOF_STATUSES: ReadonlySet<VerifyProofResponse["status"]> =
  new Set(["expired", "revoked", "invalid"]);

export function isTerminalProofStatus(
  status: VerifyProofResponse["status"],
): boolean {
  return TERMINAL_PROOF_STATUSES.has(status);
}

/**
 * GET /proofs/{id}/verify has no security requirement in the OpenAPI spec
 * (it's the public verification endpoint anyone can call by proof ID), so
 * `token` is optional. When present, it's still sent as a Bearer header for
 * any deployment that layers auth on top of the public contract.
 */
export async function verifyProof(
  proofId: string,
  signal: AbortSignal,
  token?: string | null,
): Promise<VerifyProofResponse> {
  return retryRead(async (signal) => {
    return apiClient<VerifyProofResponse>({
      path: `/proofs/${encodeURIComponent(proofId)}/verify`,
      method: "GET",
      headers: token ? bearer(token) : undefined,
      signal,
    });
  }, signal);
}
