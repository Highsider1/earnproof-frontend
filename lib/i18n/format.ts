/**
 * Locale-aware formatting helpers.
 *
 * Three rules, and every helper here exists to make one of them cheap to
 * follow:
 *
 * 1. **Never call a bare `toLocaleString()` / `toLocaleDateString()` /
 *    `toLocaleTimeString()`.** With no locale argument the result depends on
 *    the runtime's ambient locale, which differs between a developer's
 *    machine, a CI runner and a user's browser — so it is both a
 *    localization bug and a source of flaky tests.
 * 2. **Never assemble a sentence from fragments.** `` `${a} to ${b}` `` and
 *    `` `${n}m ago` `` bake English word order and English pluralization into
 *    code. `Intl.DateTimeFormat.formatRange` and `Intl.RelativeTimeFormat`
 *    produce the whole phrase, correctly, per locale.
 * 3. **Never hard-code a locale tag.** `new Intl.DateTimeFormat("en", …)`
 *    looks locale-aware but is not. Locale is a parameter with a default.
 */

import { DEFAULT_LOCALE } from "./locale";

/**
 * `Intl` formatter construction is comparatively expensive and these are
 * called per row in lists, so instances are memoized by their full option
 * signature.
 */
const formatterCache = new Map<string, unknown>();

function cached<T>(key: string, create: () => T): T {
  const existing = formatterCache.get(key);
  if (existing) return existing as T;
  const created = create();
  formatterCache.set(key, created);
  return created;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/**
 * A formatter that throws takes the whole page down with it, and the input
 * here is API data. An unparseable value is therefore rendered as-is rather
 * than crashing the render: the screen shows something imperfect instead of
 * nothing at all.
 */
function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function fallback(value: Date | string | number): string {
  return value instanceof Date ? "" : String(value);
}

/**
 * Options shared by the date/time formatters. `timeZone` is left unset by
 * default (the `Intl` default: the runtime's local time zone) so existing
 * two-argument call sites are unaffected; callers that display a persisted
 * user preference pass it explicitly, per `resolveTimeZone` in
 * `./preferences`, so a value entered in one time zone (or a
 * server-provided UTC timestamp) is never silently reinterpreted in
 * whatever zone happens to render it.
 */
export type DateFormatOptions = {
  timeZone?: string;
};

/** A date, no time component. */
export function formatDate(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!isValidDate(date)) return fallback(value);
  return cached(`date|${locale}|${options.timeZone ?? ""}`, () =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: options.timeZone }),
  ).format(date);
}

/** A time of day, no date component. */
export function formatTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!isValidDate(date)) return fallback(value);
  return cached(`time|${locale}|${options.timeZone ?? ""}`, () =>
    new Intl.DateTimeFormat(locale, { timeStyle: "medium", timeZone: options.timeZone }),
  ).format(date);
}

/** A date and a time together. */
export function formatDateTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  options: DateFormatOptions = {},
): string {
  const date = toDate(value);
  if (!isValidDate(date)) return fallback(value);
  return cached(`datetime|${locale}|${options.timeZone ?? ""}`, () =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: options.timeZone,
    }),
  ).format(date);
}

/**
 * A date and time with the viewer's timezone disclosed (#151).
 *
 * `formatDateTime` alone is ambiguous: "Sep 24, 2026, 2:00 PM" reads as a
 * local wall-clock time, but says nothing about *which* timezone that is,
 * and a proof, payment or API key's issued/expiry instant is meaningful
 * across timezones (an issuer, a verifier and a worker are rarely in the
 * same one). `timeZoneName: "short"` appends the abbreviation the
 * `Intl.DateTimeFormat` already resolves for the runtime's timezone (or an
 * explicit IANA zone, for tests), e.g. "Sep 24, 2026, 2:00 PM PDT".
 */
export function formatDateTimeWithZone(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  timeZone?: string,
): string {
  const date = toDate(value);
  if (!isValidDate(date)) return fallback(value);
  return cached(`datetime-tz|${locale}|${timeZone ?? ""}`, () =>
    new Intl.DateTimeFormat(locale, {
      // `dateStyle`/`timeStyle` cannot be combined with `timeZoneName` per
      // ECMA-402 (some engines throw "Invalid option", others silently
      // ignore one side) — the component options below are the
      // `dateStyle: "medium", timeStyle: "short"` equivalent, written out
      // so `timeZoneName` can be added alongside them.
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
      ...(timeZone ? { timeZone } : {}),
    }),
  ).format(date);
}

/**
 * A date range as one locale-formatted phrase.
 *
 * This replaces `` `${formatDate(a)} to ${formatDate(b)}` ``: the connector,
 * the order of the two dates and the elision of shared parts ("Jan 3 – 9,
 * 2026") are all locale-specific and none of them belong in JSX.
 */
export function formatDateRange(
  start: Date | string | number,
  end: Date | string | number,
  locale: string = DEFAULT_LOCALE,
): string {
  const from = toDate(start);
  const to = toDate(end);
  if (!isValidDate(from) || !isValidDate(to)) {
    return [fallback(start), fallback(end)].filter(Boolean).join(" ");
  }
  return cached(`range|${locale}`, () =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }),
  ).formatRange(from, to);
}

const RELATIVE_THRESHOLDS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; seconds: number }> = [
  { unit: "year", seconds: 60 * 60 * 24 * 365 },
  { unit: "month", seconds: 60 * 60 * 24 * 30 },
  { unit: "day", seconds: 60 * 60 * 24 },
  { unit: "hour", seconds: 60 * 60 },
  { unit: "minute", seconds: 60 },
  { unit: "second", seconds: 1 },
];

/**
 * A relative time as one locale-formatted phrase ("2 minutes ago", "in 3
 * days"), with the unit chosen from the magnitude of the difference.
 *
 * `Intl.RelativeTimeFormat` handles the plural category and the word order,
 * which is precisely what a hand-rolled `` `${n}m ago` `` cannot do for any
 * language with more than two plural forms.
 */
export function formatRelativeTime(
  value: Date | string | number,
  locale: string = DEFAULT_LOCALE,
  now: Date | number = Date.now(),
): string {
  const formatter = cached(`relative|${locale}`, () =>
    new Intl.RelativeTimeFormat(locale, { numeric: "auto" }),
  );

  const parsed = toDate(value);
  if (!isValidDate(parsed)) return fallback(value);
  const target = parsed.getTime();
  const reference = now instanceof Date ? now.getTime() : now;
  const deltaSeconds = Math.round((target - reference) / 1000);
  const magnitude = Math.abs(deltaSeconds);

  for (const threshold of RELATIVE_THRESHOLDS) {
    if (magnitude >= threshold.seconds) {
      const amount = Math.trunc(deltaSeconds / threshold.seconds);
      return formatter.format(amount, threshold.unit);
    }
  }

  // `numeric: "auto"` renders a zero-second difference as "now".
  return formatter.format(0, "second");
}

/** A number, grouped and decimal-separated for the locale. */
export function formatNumber(
  value: number,
  locale: string = DEFAULT_LOCALE,
  options: Intl.NumberFormatOptions = {},
): string {
  return cached(`number|${locale}|${JSON.stringify(options)}`, () =>
    new Intl.NumberFormat(locale, options),
  ).format(value);
}

/**
 * A list as one locale-formatted phrase ("a, b, and c"). Replaces
 * `items.join(", ")`, which bakes in an English separator and drops the
 * conjunction entirely.
 */
export function formatList(
  items: readonly string[],
  locale: string = DEFAULT_LOCALE,
  type: Intl.ListFormatType = "conjunction",
): string {
  return cached(`list|${locale}|${type}`, () =>
    new Intl.ListFormat(locale, { style: "long", type }),
  ).format(items as string[]);
}

/**
 * Plural-sensitive text.
 *
 * The caller supplies a form per CLDR plural category and the *category* is
 * chosen by `Intl.PluralRules`, not by `count === 1`. English needs only
 * `one` and `other`, but writing the selection this way means adding a
 * language with `few`/`many` is a catalog change rather than a code change.
 *
 * `other` is required; any missing category falls back to it, so a partial
 * catalog degrades to a correct-but-generic string instead of `undefined`.
 */
export type PluralForms = {
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
  other: string;
};

export function selectPlural(
  count: number,
  forms: PluralForms,
  locale: string = DEFAULT_LOCALE,
): string {
  const category = cached(`plural|${locale}`, () => new Intl.PluralRules(locale)).select(count);
  return forms[category] ?? forms.other;
}

/**
 * Plural-sensitive text with the count interpolated, so the number is
 * formatted for the locale too and the caller never concatenates.
 *
 * Forms use a `{count}` placeholder: `selectPlural` picks the form,
 * `formatNumber` renders the number, and the placeholder is substituted —
 * no fragment of the sentence is ever assembled at the call site.
 */
export function formatPlural(
  count: number,
  forms: PluralForms,
  locale: string = DEFAULT_LOCALE,
): string {
  return selectPlural(count, forms, locale).replace("{count}", formatNumber(count, locale));
}
