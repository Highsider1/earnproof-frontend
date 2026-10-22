"use client";

import { useSyncExternalStore } from "react";

/**
 * Tracks whether the page is currently being printed (or rendered to a
 * print-preview / PDF context), via the `print` media query.
 *
 * Print-only UI (see PrintableProofSummary, #148) is gated on this rather
 * than rendered unconditionally with `hidden print:block` CSS, so it never
 * exists in the DOM outside of an actual print. That keeps it out of the
 * accessibility tree and out of the way of `getByText`/`getByRole` queries
 * in tests without needing every caller to scope its assertions around a
 * duplicate, differently-formatted copy of the same content.
 *
 * Built on `useSyncExternalStore` (the React-recommended way to subscribe
 * to an external browser API like `matchMedia` without the
 * cascading-render / effect-timing pitfalls of `useState` + `useEffect`)
 * so the snapshot is always read fresh rather than cached across renders.
 */
export function usePrintMode(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function subscribe(onStoreChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") {
    return () => {};
  }

  const mediaQuery = window.matchMedia("print");

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", onStoreChange);
    return () => mediaQuery.removeEventListener("change", onStoreChange);
  }

  // Safari < 14 fallback.
  mediaQuery.addListener(onStoreChange);
  return () => mediaQuery.removeListener(onStoreChange);
}

function getSnapshot(): boolean {
  if (typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("print").matches;
}

function getServerSnapshot(): boolean {
  return false;
}
