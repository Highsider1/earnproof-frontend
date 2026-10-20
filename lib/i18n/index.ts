/**
 * Localization readiness helpers. See `lib/i18n/README.md` for the
 * conventions these exist to make cheap to follow.
 */

export {
  DEFAULT_LOCALE,
  DEFAULT_TIME_ZONE,
  PSEUDO_LOCALE,
  SUPPORTED_LOCALES,
  isPseudoLocaleEnabled,
  resolveLocale,
  resolveTimeZone,
  type SupportedLocale,
} from "./locale";

export {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatDateTimeWithZone,
  formatList,
  formatNumber,
  formatPlural,
  formatRelativeTime,
  formatTime,
  selectPlural,
  type DateFormatOptions,
  type PluralForms,
} from "./format";

export {
  formatAssetAmount,
  formatStroops,
  parseAssetAmount,
  validateAssetAmountInput,
  type FormatAssetAmountResult,
  type ParsedAmount,
} from "./amount";

export {
  clearLocalePreference,
  clearTimeZonePreference,
  detectBrowserTimeZone,
  getLocalePreference,
  getTimeZonePreference,
  setLocalePreference,
  setTimeZonePreference,
  subscribeToPreferenceChanges,
} from "./preferences";

export {
  defineMessages,
  formatMessage,
  type MessageCatalog,
  type OwnedMessages,
} from "./messages";

export {
  EXPANSION_RATIO,
  PSEUDO_PREFIX,
  PSEUDO_SUFFIX,
  countPseudoRuns,
  pseudoLocalize,
  pseudoLocalizeDeep,
  stripPseudoDelimiters,
  type PseudoLocalizeOptions,
} from "./pseudo-locale";
