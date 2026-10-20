/**
 * Minimal Freighter connect/sign helpers, extracted for wallet rotation
 * (#169), which needs to run the same connect + challenge-sign flow twice
 * in one session (current wallet, then replacement wallet) — something
 * create-proof-flow.tsx's single-wallet inline helpers aren't shaped for.
 */
import type { getAddress, requestAccess, signMessage } from "@stellar/freighter-api";
import { appConfig } from "@/config/app";

async function loadFreighter(): Promise<{
  getAddress: typeof getAddress;
  requestAccess: typeof requestAccess;
  signMessage: typeof signMessage;
}> {
  return import("@stellar/freighter-api");
}

/**
 * Requests Freighter access and returns the connected wallet's address, or
 * null if Freighter isn't available or the user declines access.
 */
export async function connectFreighterWallet(): Promise<string | null> {
  const freighter = await loadFreighter();
  const access = await freighter.requestAccess().catch(() => null);
  if (access?.address) {
    return access.address;
  }
  const address = await freighter.getAddress().catch(() => null);
  return address?.address ?? null;
}

function bytesToBase64(value: Uint8Array): string {
  let binary = "";
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

/**
 * Signs `message` with the given wallet address via Freighter. Returns
 * null if the wallet declines, is unavailable, or returns no signature
 * (e.g. the user cancels the signing prompt).
 */
export async function signFreighterMessage(
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
