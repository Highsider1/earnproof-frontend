/**
 * Pseudo-localization.
 *
 * Pseudo-localization is a translation-free way to find the layout and
 * accessibility bugs a real translation would find. It rewrites English into
 * text that is still readable but:
 *
 * - **accented**, so any string that reaches the screen without going
 *   through the localization path is instantly visible as plain ASCII;
 * - **longer**, because most European translations of English run 30-40%
 *   longer, which is what exposes clipping, truncation, `overflow: hidden`
 *   and fixed-width containers;
 * - **delimited**, so a string assembled from fragments shows up as several
 *   bracketed runs instead of one, making concatenation visible at a glance.
 *
 * What it deliberately does **not** touch:
 *
 * - `{placeholders}`, so an interpolated value still lands where it belongs;
 * - digits and punctuation, so a pseudo-localized screenshot is still
 *   legible enough to review.
 *
 * This module is pure and deterministic — the same input always produces the
 * same output — so it can be asserted on exactly in tests rather than eyeballed.
 */

/**
 * Character map. Each replacement is a single code point that is visually
 * close to the original, so pseudo-localized text stays readable while being
 * unmistakably not-English.
 */
const ACCENT_MAP: Readonly<Record<string, string>> = {
  a: "á", b: "ƀ", c: "ç", d: "ð", e: "é", f: "ƒ", g: "ĝ", h: "ĥ", i: "í",
  j: "ĵ", k: "ķ", l: "ļ", m: "ɱ", n: "ñ", o: "ó", p: "þ", q: " q", r: "ŕ",
  s: "š", t: "ţ", u: "ú", v: "ṽ", w: "ŵ", x: "ẋ", y: "ý", z: "ž",
  A: "Á", B: "Ɓ", C: "Ç", D: "Ð", E: "É", F: "Ƒ", G: "Ĝ", H: "Ĥ", I: "Í",
  J: "Ĵ", K: "Ķ", L: "Ļ", M: "Ṁ", N: "Ñ", O: "Ó", P: "Þ", Q: "Q", R: "Ŕ",
  S: "Š", T: "Ţ", U: "Ú", V: "Ṽ", W: "Ŵ", X: "Ẋ", Y: "Ý", Z: "Ž",
};

/** Opening and closing delimiters, so one string is visibly one string. */
export const PSEUDO_PREFIX = "⟦";
export const PSEUDO_SUFFIX = "⟧";

/**
 * Target growth over the source text, matching the widely-used 40% figure
 * for English -> German/Finnish expansion. Padding is appended as a run of
 * vowels so it wraps like real words rather than as an unbreakable token.
 */
export const EXPANSION_RATIO = 1.4;

const PADDING_ALPHABET = "áéíóúàèìòù";

/** Segments a string into placeholder and translatable runs. */
const PLACEHOLDER_PATTERN = /(\{[^}]*\}|%[sd@]|<[^>]+>)/g;

function accentuate(text: string): string {
  let out = "";
  for (const character of text) {
    out += ACCENT_MAP[character] ?? character;
  }
  return out;
}

/**
 * Deterministic padding of a given length. Not random: a pseudo-locale
 * snapshot or assertion has to be reproducible.
 */
function padding(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += PADDING_ALPHABET[i % PADDING_ALPHABET.length];
  }
  return out;
}

export type PseudoLocalizeOptions = {
  /** Set to 1 to accentuate without expanding. */
  expansionRatio?: number;
  /** Set false to omit the delimiters (useful when asserting on length). */
  delimiters?: boolean;
};

/**
 * Pseudo-localize one user-facing string.
 *
 * Empty and whitespace-only strings are returned untouched: delimiting an
 * empty string would turn a deliberately blank label into visible glyphs and
 * change what the accessibility tree reports.
 */
export function pseudoLocalize(text: string, options: PseudoLocalizeOptions = {}): string {
  if (typeof text !== "string" || text.trim().length === 0) {
    return text;
  }

  const ratio = options.expansionRatio ?? EXPANSION_RATIO;
  const useDelimiters = options.delimiters ?? true;

  const accented = text
    .split(PLACEHOLDER_PATTERN)
    .map((segment, index) => (index % 2 === 1 ? segment : accentuate(segment)))
    .join("");

  const extra = Math.max(0, Math.round(text.length * (ratio - 1)));
  const expanded = extra > 0 ? `${accented} ${padding(extra)}` : accented;

  return useDelimiters ? `${PSEUDO_PREFIX}${expanded}${PSEUDO_SUFFIX}` : expanded;
}

/**
 * Recursively pseudo-localize every string in a structure. Used to run a
 * whole message catalog, or a component's props, through the pseudo-locale
 * without touching non-string values.
 */
export function pseudoLocalizeDeep<T>(value: T, options: PseudoLocalizeOptions = {}): T {
  if (typeof value === "string") {
    return pseudoLocalize(value, options) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => pseudoLocalizeDeep(item, options)) as unknown as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        pseudoLocalizeDeep(item, options),
      ]),
    ) as unknown as T;
  }
  return value;
}

/** Strip pseudo-localization delimiters, for asserting on the inner text. */
export function stripPseudoDelimiters(text: string): string {
  return text.split(PSEUDO_PREFIX).join("").split(PSEUDO_SUFFIX).join("");
}

/**
 * How many delimited runs a rendered string contains.
 *
 * A label built from one owned message is one run. A label assembled from
 * fragments in JSX is two or more — which is what makes concatenation
 * visible instead of merely suspected.
 */
export function countPseudoRuns(text: string): number {
  return text.split(PSEUDO_PREFIX).length - 1;
}
