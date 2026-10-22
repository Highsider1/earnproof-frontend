import type { Page } from "@playwright/test";

/**
 * Deterministic mock of the Freighter wallet extension's page-relay
 * protocol (`@stellar/freighter-api` talks to the extension exclusively via
 * `window.postMessage`, never via a global object). This installs a
 * `window.addEventListener("message", ...)` responder before any app script
 * runs, so `requestAccess`, `getAddress`, `requestAllowedStatus`, and
 * `signMessage` all resolve without a real browser extension, a real
 * signing key, or any network dependency.
 *
 * The message shapes here mirror the request/response contract in
 * `@stellar/freighter-api`'s built output (source/response envelope
 * `FREIGHTER_EXTERNAL_MSG_REQUEST` / `FREIGHTER_EXTERNAL_MSG_RESPONSE`,
 * echoing the request's `messageId` back as `messagedId`). No wallet
 * secrets are involved: the "signature" produced is a static synthetic
 * string, not a real cryptographic signature over any key material.
 */
export type FreighterMockOptions = {
  address: string;
  signedMessage?: string;
  /** Simulate the extension being absent / access denied. */
  denyAccess?: boolean;
};

export async function installFreighterMock(page: Page, options: FreighterMockOptions) {
  const { address, denyAccess = false } = options;
  const signedMessage = options.signedMessage ?? "e2e-synthetic-signature.not-a-real-signature";

  await page.addInitScript(
    ([addr, signed, deny]) => {
      const REQUEST_SOURCE = "FREIGHTER_EXTERNAL_MSG_REQUEST";
      const RESPONSE_SOURCE = "FREIGHTER_EXTERNAL_MSG_RESPONSE";

      window.addEventListener("message", (event: MessageEvent) => {
        if (event.source !== window) return;
        const data = event.data as { source?: string; messageId?: number; type?: string } | undefined;
        if (!data || data.source !== REQUEST_SOURCE) return;

        const respond = (payload: Record<string, unknown>) => {
          window.postMessage(
            {
              source: RESPONSE_SOURCE,
              messagedId: data.messageId,
              ...payload,
            },
            window.location.origin,
          );
        };

        switch (data.type) {
          case "REQUEST_ACCESS": {
            if (deny) {
              respond({ publicKey: "", apiError: { code: -4, message: "User declined access" } });
              return;
            }
            respond({ publicKey: addr });
            return;
          }
          case "REQUEST_PUBLIC_KEY": {
            respond({ publicKey: deny ? "" : addr });
            return;
          }
          case "REQUEST_ALLOWED_STATUS": {
            respond({ isAllowed: !deny });
            return;
          }
          case "SUBMIT_BLOB": {
            // Note: the response field is `signedBlob`, not `signedMessage`
            // — the library remaps it internally.
            if (deny) {
              respond({ signedBlob: null, signerAddress: "", apiError: { code: -4, message: "User declined signing" } });
              return;
            }
            respond({ signedBlob: signed, signerAddress: addr });
            return;
          }
          default:
            respond({});
        }
      });
    },
    [address, signedMessage, denyAccess] as const,
  );
}
