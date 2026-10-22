/**
 * Locale resolution for EarnProof.
 *
 * The app ships one language today. That is exactly why this module exists:
 * the expensive part of localization is never the translation, it is the
 * hard-coded assumptions ("en", `toLocaleString()` with no argument, a
 * sentence assembled from fragments) that accumulate while there is only one
 * language and have to be unpicked later.
 *
 * Every formatting helper in `lib/i18n/format.ts` takes an explicit locale
 * that defaults to `DEFAULT_LOCALE`, so no call site ever depends on the
 * runtime's ambient locale — which differs between a developer's machine, a
 * CI runner and a user's browser, and is therefore also a source of
 * non-deterministic tests and snapshots.
 */

/** The locale the app is authored in. */
export const DEFAULT_LOCALE = "en-US";

/**
 * The pseudo-locale. `en-XA` is the conventional BCP 47 private-use tag for
 * accented/expanded pseudo-localization; it is a *test* locale and is never
 * offered to users.
 */
export const PSEUDO_LOCALE = "en-XA";

/** Locales the app can currently render. Translations are not shipped yet. */
export const SUPPORTED_LOCALES = [DEFAULT_LOCALE] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Whether pseudo-localization is active.
 *
 * Opt-in through `NEXT_PUBLIC_PSEUDO_LOCALE=1` so it can be switched on for a
 * preview deployment or a local run, and is off everywhere else. The tests
 * do not depend on this flag — they call `pseudoLocalize` directly — so
 * enabling it is a human-facing convenience, not a test dependency.
 */
export function isPseudoLocaleEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PSEUDO_LOCALE === "1";
}

/**
 * Narrow an arbitrary locale request to one the app can render, falling back
 * to the default rather than handing an unknown tag to `Intl`.
 */
export function resolveLocale(requested?: string | null): string {
  if (!requested) return DEFAULT_LOCALE;
  if (requested === PSEUDO_LOCALE) return DEFAULT_LOCALE;
  return (SUPPORTED_LOCALES as readonly string[]).includes(requested)
    ? requested
    : DEFAULT_LOCALE;
}

/**
 * The time zone the app falls back to when no preference is stored and the
 * runtime's own zone cannot be determined. UTC rather than a guess, because
 * a wrong-but-plausible default (e.g. assuming US Eastern) is worse than an
 * explicit, unambiguous one.
 */
export const DEFAULT_TIME_ZONE = "UTC";

/**
 * Validate an IANA time zone identifier the same way `resolveLocale`
 * validates a locale tag: an unrecognized or malformed value falls back to
 * `DEFAULT_TIME_ZONE` rather than reaching `Intl.DateTimeFormat`, whose
 * `RangeError` on an invalid `timeZone` would otherwise take the render
 * down with it (the same failure mode `format.ts`'s "never throw on bad
 * input" rule exists to avoid).
 */
export function resolveTimeZone(requested?: string | null): string {
  if (!requested) return DEFAULT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat(DEFAULT_LOCALE, { timeZone: requested });
    return requested;
  } catch {
    return DEFAULT_TIME_ZONE;
  }
}
