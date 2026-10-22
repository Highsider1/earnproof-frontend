import type { Page } from "@playwright/test";

/**
 * The Freighter browser extension talks to `@stellar/freighter-api` via
 * `window.postMessage`, matching requests by message id
 * (see @stellar/freighter-api/build/index.min.js). There is no extension
 * installed in the Playwright browser, so requests like REQUEST_ACCESS or
 * SUBMIT_BLOB would otherwise hang forever (only REQUEST_PUBLIC_KEY /
 * REQUEST_CONNECTION_STATUS have a built-in 2s timeout fallback).
 *
 * This installs a page-init script that answers those messages the same
 * way an unlocked Freighter wallet would, so the wallet-connect step of
 * the proof creation flow can be exercised deterministically.
 */
export async function mockFreighterWallet(
  page: Page,
  options?: { publicKey?: string; signedMessage?: string },
) {
  const publicKey = options?.publicKey ?? "GAEXAMPLEACCOUNTIDENARSTELLARTESTNETWALLET0000";
  const signedMessage = options?.signedMessage ?? "mock-signature-base64";

  await page.addInitScript(
    ({ publicKey, signedMessage }) => {
      window.addEventListener("message", (event) => {
        const data = event.data as { source?: string; type?: string; messageId?: number } | undefined;
        if (!data || data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST") {
          return;
        }

        const response: Record<string, unknown> = {
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
          messagedId: data.messageId,
        };

        switch (data.type) {
          case "REQUEST_ACCESS":
          case "REQUEST_PUBLIC_KEY":
            response.publicKey = publicKey;
            break;
          case "REQUEST_ALLOWED_STATUS":
            response.isAllowed = true;
            break;
          case "SUBMIT_BLOB":
            response.signedBlob = signedMessage;
            response.signerAddress = publicKey;
            break;
          case "REQUEST_CONNECTION_STATUS":
            response.isConnected = true;
            break;
          default:
            break;
        }

        window.postMessage(response, window.location.origin);
      });
    },
    { publicKey, signedMessage },
  );

  return { publicKey, signedMessage };
}
