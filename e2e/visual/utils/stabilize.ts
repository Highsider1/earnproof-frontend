import type { Page, Route } from "@playwright/test";

/**
 * Shared stabilization helpers for the visual regression suite.
 *
 * These exist to remove *incidental* non-determinism (animation timing,
 * network races, real backend data) without hiding *real* layout defects.
 * Nothing here changes layout, spacing, or component markup.
 */

const API_URL = "http://localhost:4000/api/v1";
const MOTION_STABILIZER_CSS = `
  *, *::before, *::after {
    animation-duration: 0ms !important;
    animation-delay: 0ms !important;
    transition-duration: 0ms !important;
    transition-delay: 0ms !important;
    scroll-behavior: auto !important;
    caret-color: transparent !important;
  }
`;

/** Disable CSS animations/transitions/caret blinking so a mid-transition
 * frame is never captured. Playwright's `animations: "disabled"` screenshot
 * option already finishes CSS animations/transitions before the shot, this
 * adds a belt-and-braces global override for anything driven by JS timers. */
export async function disableMotion(page: Page) {
  await page.evaluate((content) => {
    const nonceSource = document.querySelector<HTMLScriptElement | HTMLStyleElement>(
      "script[nonce], style[nonce]",
    );
    const nonce = nonceSource?.nonce || nonceSource?.getAttribute("nonce");
    const style = document.createElement("style");

    if (nonce) {
      style.nonce = nonce;
      style.setAttribute("nonce", nonce);
    }

    style.appendChild(document.createTextNode(content));
    document.head.appendChild(style);
  }, MOTION_STABILIZER_CSS);
}

/** Seed a fake authenticated wallet session in localStorage before any app
 * script runs, so tests can reach "connected" states without touching a
 * real Freighter extension or real wallet material. */
export async function seedSession(
  page: Page,
  session: { token: string; user: unknown },
) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("earnproof.session", JSON.stringify(value));
  }, session);
}

/**
 * `@stellar/freighter-api` talks to the browser extension purely over
 * `window.postMessage` — there is no `window.freighter*` object to stub.
 * With no extension listening:
 *  - `requestAccess()` (message type REQUEST_ACCESS) never gets a reply and
 *    has no built-in timeout, so it hangs forever. This is the *real*,
 *    unmodified app behavior with no extension installed, and is exactly
 *    the "loading" state below — nothing needs to be mocked for it.
 *  - `getAddress()` (message type REQUEST_PUBLIC_KEY) does have a 2s
 *    built-in timeout and resolves to an empty public key, but it is only
 *    reached once `requestAccess()` settles, which it never does.
 *
 * To reach the "wallet error" state deterministically (`requestAccess`
 * resolving with no address, so the flow falls through and reports
 * "Freighter was not found") without waiting on a real extension, this
 * installs a page-level auto-responder that answers every Freighter
 * request message immediately with an empty public key — i.e. it plays
 * the part of "an extension is present but grants no address", which
 * `getFreighterAddress()` already handles as a real failure path.
 */
export async function mockFreighterNoAccess(page: Page) {
  await page.addInitScript(() => {
    window.addEventListener("message", (event) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        !event.data ||
        event.data.source !== "FREIGHTER_EXTERNAL_MSG_REQUEST"
      ) {
        return;
      }
      window.postMessage(
        {
          source: "FREIGHTER_EXTERNAL_MSG_RESPONSE",
          messagedId: event.data.messageId,
          publicKey: "",
        },
        window.location.origin,
      );
    });
  });
}

type JsonRoute = Record<string, unknown> | unknown[];

/**
 * Intercept one EarnProof API path with a fixed, synthetic JSON payload.
 * `path` may be a Playwright glob (e.g. "/proofs/*\/verify").
 */
export async function mockApi(
  page: Page,
  path: string,
  body: JsonRoute,
  options: { status?: number; delayMs?: number } = {},
) {
  await page.route(`${API_URL}${path}`, async (route: Route) => {
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    await route.fulfill({
      status: options.status ?? 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

/** Fail one EarnProof API path outright (used for error-state screenshots). */
export async function mockApiFailure(page: Page, path: string, status = 500) {
  await page.route(`${API_URL}${path}`, async (route: Route) => {
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ message: "fixture failure" }),
    });
  });
}
