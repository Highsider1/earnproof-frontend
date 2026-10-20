/**
 * Persisted formatting preferences: locale and time zone.
 *
 * There is no user-preferences endpoint in the API today (see
 * `lib/api/openapi/earnproof-api.v1.json`), so the preference lives in
 * `localStorage`, scoped to the browser rather than the account. It is read
 * back through `resolveLocale`/`resolveTimeZone`, so a value that becomes
 * invalid (a locale this build no longer supports, a corrupted or
 * hand-edited storage value) degrades deterministically to the app default
 * instead of surfacing to `Intl` or throwing.
 */

import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, resolveLocale, resolveTimeZone } from "./locale";

const LOCALE_STORAGE_KEY = "earnproof.preferences.locale";
const TIME_ZONE_STORAGE_KEY = "earnproof.preferences.timeZone";

/**
 * A same-tab change notifier for `useSyncExternalStore` consumers.
 *
 * The browser's own `storage` event only fires in *other* tabs/windows, never
 * the one that made the write, so a settings UI in this tab would not see its
 * own change without this. `subscribeToPreferenceChanges` combines both: this
 * emitter for local writes, and `storage` for writes made elsewhere.
 */
const listeners = new Set<() => void>();

function notifyPreferenceChange(): void {
  for (const listener of listeners) listener();
}

/**
 * Subscribe to any locale/time-zone preference change, from this tab or
 * another. Intended for `useSyncExternalStore`'s `subscribe` parameter.
 */
export function subscribeToPreferenceChanges(onChange: () => void): () => void {
  listeners.add(onChange);
  if (typeof window === "undefined") {
    return () => listeners.delete(onChange);
  }

  const onStorage = (event: StorageEvent) => {
    if (event.key === LOCALE_STORAGE_KEY || event.key === TIME_ZONE_STORAGE_KEY) {
      onChange();
    }
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * `localStorage` throws in a private-browsing mode that blocks storage, and
 * is absent entirely during server-side rendering. Every access goes
 * through this pair so a storage failure degrades to "no preference
 * stored" instead of taking the render down with it.
 */
function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Best-effort: a storage failure here is no worse than the preference
    // never having been persisted in the first place.
  }
}

/** The stored locale preference, narrowed to one the app can render. */
export function getLocalePreference(): string {
  return resolveLocale(readStorage(LOCALE_STORAGE_KEY));
}

/**
 * Persist a locale preference. Returns whether the value was actually
 * stored (rather than a supported-but-unpersisted default) — false when
 * storage is unavailable or the value is not one of `SUPPORTED_LOCALES`, so
 * a settings UI can surface that the choice will not survive a reload.
 */
export function setLocalePreference(locale: string): boolean {
  const resolved = resolveLocale(locale);
  if (resolved !== locale) return false;
  const stored = writeStorage(LOCALE_STORAGE_KEY, resolved);
  if (stored) notifyPreferenceChange();
  return stored;
}

export function clearLocalePreference(): void {
  removeStorage(LOCALE_STORAGE_KEY);
  notifyPreferenceChange();
}

/** The stored time zone preference, narrowed to a valid IANA identifier. */
export function getTimeZonePreference(): string {
  return resolveTimeZone(readStorage(TIME_ZONE_STORAGE_KEY));
}

/**
 * Persist a time zone preference. Returns whether the value was actually
 * stored, for the same reason as `setLocalePreference`.
 */
export function setTimeZonePreference(timeZone: string): boolean {
  const resolved = resolveTimeZone(timeZone);
  if (resolved !== timeZone) return false;
  const stored = writeStorage(TIME_ZONE_STORAGE_KEY, resolved);
  if (stored) notifyPreferenceChange();
  return stored;
}

export function clearTimeZonePreference(): void {
  removeStorage(TIME_ZONE_STORAGE_KEY);
  notifyPreferenceChange();
}

/** The browser's own time zone, when it can be determined. */
export function detectBrowserTimeZone(): string | null {
  try {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return detected || null;
  } catch {
    return null;
  }
}

export { DEFAULT_LOCALE, DEFAULT_TIME_ZONE };
