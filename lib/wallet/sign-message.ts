/**
 * Freighter message-signing helper.
 *
 * Mirrors the inline signFreighterMessage helper already used by the proof
 * wizards (e.g. aggregate-earnings-proof-wizard.tsx) for the wallet
 * challenge/verify flow, factored out for callers (like the recent-auth
 * gate) that need it outside a specific wizard.
 */

import type { signMessage as SignMessageFn } from "@stellar/freighter-api";
import { appConfig } from "@/config/app";

async function loadFreighter(): Promise<{ signMessage: typeof SignMessageFn }> {
  return import("@stellar/freighter-api");
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/**
 * Signs `message` with the given wallet address via Freighter. Returns the
 * base64-encoded signature, or null if Freighter is unavailable, the user
 * declined, or it otherwise failed to return a signature.
 */
export async function signWithFreighter(
  message: string,
  walletAddress: string,
): Promise<string | null> {
  const freighter = await loadFreighter();
  const response = await freighter
    .signMessage(message, {
      networkPassphrase: appConfig.stellarNetworkPassphrase,
      address: walletAddress,
    })
    .catch(() => null);

  if (!response?.signedMessage) {
    return null;
  }

  if (typeof response.signedMessage === "string") {
    return response.signedMessage;
  }

  return bytesToBase64(response.signedMessage);
}
