/**
 * Correlation identifiers for client error telemetry.
 *
 * What these identifiers ARE: opaque random values that let an on-call
 * responder group the errors of a single page load, and let a user quote one
 * id in a support request.
 *
 * What they are explicitly NOT, and the properties that keep them that way:
 *
 * - **Not derived from anything.** They are generated from a CSPRNG with no
 *   input. They cannot be computed from a wallet address, an account, a
 *   proof, or a device, so they reveal nothing about who produced them and
 *   two users' ids can never collide meaningfully.
 * - **Not an authenticator.** Nothing in this app accepts a correlation id
 *   as a credential; it grants no access and is never sent in an
 *   `Authorization` header. It is safe to print in a log or paste into a
 *   support ticket precisely because holding one proves nothing.
 * - **Not persistent.** The page-load id lives in a module-scoped variable
 *   and dies with the document. It is never written to `localStorage`,
 *   `sessionStorage`, a cookie, or an URL, so it cannot become a
 *   cross-session tracking identifier.
 */

/** Length of a generated id in hex characters (128 bits of entropy). */
const ID_LENGTH = 32;

const HEX = "0123456789abcdef";

/**
 * Generate an opaque 128-bit identifier.
 *
 * Prefers `crypto.getRandomValues`; falls back to `Math.random` only when no
 * Web Crypto implementation is available. The fallback is acceptable here
 * *because* the id is not a secret and grants nothing — the property that
 * matters is uniqueness, not unpredictability.
 */
export function generateCorrelationId(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(ID_LENGTH / 2);
    webCrypto.getRandomValues(bytes);
    let id = "";
    for (const byte of bytes) {
      id += HEX[byte >> 4] + HEX[byte & 0x0f];
    }
    return id;
  }

  let id = "";
  for (let i = 0; i < ID_LENGTH; i += 1) {
    id += HEX[Math.floor(Math.random() * 16)];
  }
  return id;
}

let pageLoadId: string | null = null;

/**
 * The id shared by every error event from one page load. Module-scoped and
 * deliberately not persisted anywhere — a reload produces a new one.
 */
export function getPageLoadId(): string {
  if (pageLoadId === null) {
    pageLoadId = generateCorrelationId();
  }
  return pageLoadId;
}

/** Test seam: drop the cached page-load id, as a real page load would. */
export function resetPageLoadId(): void {
  pageLoadId = null;
}
