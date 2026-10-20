"use client";

import { useId, useState, useSyncExternalStore } from "react";
import {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  SUPPORTED_LOCALES,
  detectBrowserTimeZone,
  formatDateTime,
  getLocalePreference,
  getTimeZonePreference,
  resolveTimeZone,
  setLocalePreference,
  setTimeZonePreference,
  subscribeToPreferenceChanges,
} from "@/lib/i18n";

/**
 * A representative, deliberately short list of time zones covering every
 * UTC offset in whole- and half-hour steps, rather than the full IANA
 * database (`Intl.supportedValuesOf("timeZone")` returns 400+ entries,
 * unusable as a flat `<select>`). The browser's own zone is always added
 * ahead of this list when it resolves to something not already in it, so a
 * user is never limited to a zone that does not describe them.
 */
const COMMON_TIME_ZONES = [
  "UTC",
  "Pacific/Midway",
  "America/Anchorage",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "America/Sao_Paulo",
  "Atlantic/Azores",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Athens",
  "Africa/Lagos",
  "Africa/Nairobi",
  "Asia/Dubai",
  "Asia/Karachi",
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Australia/Sydney",
  "Pacific/Auckland",
] as const;

const LOCALE_LABELS: Record<string, string> = {
  "en-US": "English (United States)",
};

function timeZoneOptions(browserTimeZone: string | null): string[] {
  if (browserTimeZone && !COMMON_TIME_ZONES.includes(browserTimeZone as (typeof COMMON_TIME_ZONES)[number])) {
    return [browserTimeZone, ...COMMON_TIME_ZONES];
  }
  return [...COMMON_TIME_ZONES];
}

type SaveState = "idle" | "saved" | "unavailable";

/**
 * `localStorage` (and the real browser time zone) are unavailable during
 * server rendering, so every server/first-client-render snapshot below is
 * the app default or `null` — matching what an unhydrated client render
 * shows before `useSyncExternalStore` swaps in the real, browser-only value
 * on the next render. This is the standard `useSyncExternalStore` way to
 * detect "has this component hydrated on the client yet": `getSnapshot`
 * returns `true` (a `subscribe` that is never called can't ever fire an
 * update, since the value can't change after mount) and `getServerSnapshot`
 * returns `false`, so the transition from `false` to `true` happens exactly
 * once, right after hydration.
 */
function noopSubscribe(): () => void {
  return () => {};
}
function trueSnapshot(): boolean {
  return true;
}
function falseSnapshot(): boolean {
  return false;
}

function localeServerSnapshot(): string {
  return DEFAULT_LOCALE;
}

function timeZoneServerSnapshot(): string {
  return DEFAULT_TIME_ZONE;
}

function browserTimeZoneServerSnapshot(): string | null {
  return null;
}

export function FormattingPreferences() {
  const localeFieldId = useId();
  const timeZoneFieldId = useId();
  const [saveState, setSaveState] = useState<SaveState>("idle");

  // useSyncExternalStore (not useState+useEffect) because localStorage is an
  // external store: this reads it synchronously on the client, matches the
  // DEFAULT_LOCALE/DEFAULT_TIME_ZONE server snapshot during SSR and the first
  // client render (avoiding a hydration mismatch), and re-renders on change
  // from this tab (a local write) or another (the `storage` event), both
  // wired through `subscribeToPreferenceChanges`.
  const locale = useSyncExternalStore(
    subscribeToPreferenceChanges,
    getLocalePreference,
    localeServerSnapshot,
  );
  const timeZone = useSyncExternalStore(
    subscribeToPreferenceChanges,
    getTimeZonePreference,
    timeZoneServerSnapshot,
  );
  const browserTimeZone = useSyncExternalStore(
    noopSubscribe,
    detectBrowserTimeZone,
    browserTimeZoneServerSnapshot,
  );
  const hydrated = useSyncExternalStore(noopSubscribe, trueSnapshot, falseSnapshot);

  function handleLocaleChange(next: string) {
    setSaveState(setLocalePreference(next) ? "saved" : "unavailable");
  }

  function handleTimeZoneChange(next: string) {
    // A manual selection always comes from `timeZoneOptions`, which is
    // already resolved, but a corrupted/hand-edited value must still fall
    // back deterministically rather than reach `formatDateTime` unvalidated.
    const resolved = resolveTimeZone(next);
    setSaveState(setTimeZonePreference(resolved) ? "saved" : "unavailable");
  }

  const preview = hydrated ? formatDateTime(new Date(), locale, { timeZone }) : null;

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h2 className="text-xl font-semibold text-white">Formatting preferences</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">
        Choose how dates, times, and numbers are displayed. These preferences are
        saved in this browser and applied wherever EarnProof formats a date or
        number for you.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        <div className="grid gap-[7px]">
          <label className="text-xs font-semibold text-slate-300" htmlFor={localeFieldId}>
            Language and region
          </label>
          <select
            aria-describedby={SUPPORTED_LOCALES.length === 1 ? `${localeFieldId}-hint` : undefined}
            className="h-11 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            id={localeFieldId}
            onChange={(event) => handleLocaleChange(event.target.value)}
            value={locale}
          >
            {SUPPORTED_LOCALES.map((supported) => (
              <option key={supported} value={supported}>
                {LOCALE_LABELS[supported] ?? supported}
              </option>
            ))}
          </select>
          {SUPPORTED_LOCALES.length === 1 && (
            <span className="text-xs font-normal text-slate-400" id={`${localeFieldId}-hint`}>
              EarnProof currently supports one language. More will appear here as
              they ship.
            </span>
          )}
        </div>

        <div className="grid gap-[7px]">
          <label className="text-xs font-semibold text-slate-300" htmlFor={timeZoneFieldId}>
            Time zone
          </label>
          <select
            className="h-11 rounded-lg border border-white/15 bg-slate-900 px-3 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            id={timeZoneFieldId}
            onChange={(event) => handleTimeZoneChange(event.target.value)}
            value={timeZone}
          >
            {timeZoneOptions(browserTimeZone).map((zone) => (
              <option key={zone} value={zone}>
                {zone === browserTimeZone ? `${zone} (detected)` : zone}
              </option>
            ))}
          </select>
        </div>
      </div>

      {preview && (
        <p className="mt-5 text-sm text-slate-300">
          Preview: <span className="text-white">{preview}</span>{" "}
          <span className="text-slate-400">({timeZone})</span>
        </p>
      )}

      {saveState === "unavailable" && (
        <p className="mt-3 text-xs text-amber-200">
          This browser blocked saving preferences (private browsing or storage is
          disabled), so this choice will not persist after you leave the page.
        </p>
      )}
    </div>
  );
}
