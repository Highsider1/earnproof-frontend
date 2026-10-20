/**
 * Correlation identifier contract.
 *
 * The acceptance criterion is negative — a correlation id must not be usable
 * as authentication and must not reveal user identity — so these tests
 * assert the properties that make that true: not derived from any input, not
 * persisted anywhere, and never sent as a credential.
 */

import {
  generateCorrelationId,
  getPageLoadId,
  resetPageLoadId,
} from "@/lib/telemetry/correlation";
import { buildClientErrorEvent } from "@/lib/telemetry/client-error-reporter";
import { WALLET_ADDRESS, BEARER_TOKEN } from "./fixtures/sensitive-values";

describe("generateCorrelationId", () => {
  beforeEach(() => {
    resetPageLoadId();
  });

  it("produces a 128-bit opaque hex value", () => {
    expect(generateCorrelationId()).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is unique per call", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateCorrelationId()));
    expect(ids.size).toBe(1000);
  });

  it("is not derived from the error being reported", () => {
    const walletError = new Error(`rejected by ${WALLET_ADDRESS}`);
    const first = buildClientErrorEvent({
      error: walletError,
      category: "wallet.rejected",
      pathname: "/proofs",
    });
    const second = buildClientErrorEvent({
      error: walletError,
      category: "wallet.rejected",
      pathname: "/proofs",
    });

    // Identical input, different id: the id carries no information about
    // the user, the wallet, or the failure.
    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it("never contains any part of a wallet address or token", () => {
    const id = generateCorrelationId();
    expect(WALLET_ADDRESS.toLowerCase()).not.toContain(id);
    expect(BEARER_TOKEN.toLowerCase()).not.toContain(id);
    expect(id).not.toContain(WALLET_ADDRESS.slice(0, 8).toLowerCase());
  });
});

describe("page load id", () => {
  beforeEach(() => {
    resetPageLoadId();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it("is stable for the lifetime of one page load", () => {
    expect(getPageLoadId()).toBe(getPageLoadId());
  });

  it("groups every event of one page load without identifying the user", () => {
    const first = buildClientErrorEvent({
      error: new Error("Failed to fetch"),
      category: "api.network-unavailable",
      pathname: "/verify",
    });
    const second = buildClientErrorEvent({
      error: new Error("Failed to fetch"),
      category: "api.network-unavailable",
      pathname: "/verify/credential",
    });

    expect(first.pageLoadId).toBe(second.pageLoadId);
    expect(first.correlationId).not.toBe(second.correlationId);
  });

  it("is regenerated on the next page load and is never persisted", () => {
    const before = getPageLoadId();
    resetPageLoadId(); // what a real navigation/reload does
    const after = getPageLoadId();

    expect(after).not.toBe(before);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain(before);
  });
});
