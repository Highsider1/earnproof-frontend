# Localization readiness

EarnProof ships one language today. That is exactly why this directory
exists: the expensive part of localization is never the translation, it is
unpicking the assumptions — a hard-coded `"en"`, a bare `toLocaleString()`, a
sentence assembled from fragments, a box sized for English — that accumulate
while there is only one language.

These are the conventions, the helpers that make them cheap to follow, and
the tests in `tests/i18n/` that hold the codebase to them.

## The conventions

### 1. User-facing strings have an owner

Every string a user can read belongs to exactly one module, under a stable
namespaced key:

```ts
import { defineMessages } from "@/lib/i18n";

const messages = defineMessages("status", {
  title: "System status",
  lastCheckedLabel: "Last checked:",
});

<h1>{messages.title}</h1>
```

The namespace is the owner and `status.title` is the stable key a
translation system will key off. Punctuation that belongs to a label — the
colon after "Last checked" — lives *in* the message, because its form and
spacing are locale-specific (French sets a space before a colon).

`app/status/page.tsx` is the migrated reference route, and
`tests/i18n/conventions.test.ts` guards it so the convention cannot silently
regress. The other routes are not migrated yet; that is deliberate scope,
not an oversight.

### 2. Never concatenate sentence fragments

```ts
// No: three fragments a translator can never reorder.
`Income ${operator} ${amount} ${asset}`

// Yes: one owned message with placeholders.
formatMessage(messages.claim, { operator, amount, asset })
```

The same rule is why there is no `` `${formatDate(a)} to ${formatDate(b)}` ``
and no `` `${n}m ago` `` in the codebase: `formatDateRange` and
`formatRelativeTime` produce the whole phrase, with the connector, word order
and plural form the locale actually needs.

`tests/i18n/conventions.test.ts` scans `app/` and `components/` for template
literals that split a sentence around a value. Class-name templates are
excluded — Tailwind composition is the legitimate use of a template literal
in JSX.

### 3. Dates, numbers and plurals go through `lib/i18n/format.ts`

| Instead of | Use |
| --- | --- |
| `date.toLocaleString()` | `formatDateTime(date)` |
| `date.toLocaleTimeString()` | `formatTime(date)` |
| `new Intl.DateTimeFormat("en", …)` | `formatDate(date, locale)` |
| `` `${a} to ${b}` `` | `formatDateRange(a, b)` |
| `` `${n}m ago` `` | `formatRelativeTime(date)` |
| `String(n)` | `formatNumber(n)` |
| `items.join(", ")` | `formatList(items)` |
| `n === 1 ? "payment" : "payments"` | `formatPlural(n, { one: "{count} payment", other: "{count} payments" })` |

Every helper takes an explicit locale defaulting to `DEFAULT_LOCALE`, so no
call site depends on the runtime's ambient locale — which differs between a
developer's machine, a CI runner and a user's browser, and is therefore also
a source of non-deterministic tests.

Plural selection goes through `Intl.PluralRules`, not `count === 1`. English
needs only `one` and `other`, but writing it this way means adding a language
with `few`/`many` is a catalog change rather than a code change.

The formatters return an unparseable value as-is instead of throwing: their
input is API data, and a formatter that throws takes the whole render with
it.

## The pseudo-locale

Pseudo-localization finds the layout and accessibility bugs a real
translation would find, without any translation existing. Set
`NEXT_PUBLIC_PSEUDO_LOCALE=1` and every message in every catalog comes back:

```
"System status"  ->  "⟦Šýšţéɱ šţáţúš áéíóúàèìò⟧"
```

- **Accented**, so any string that reached the screen without going through
  the localization path is instantly visible as plain ASCII.
- **~40% longer**, matching English→German/Finnish expansion — which is what
  exposes clipping, truncation and fixed-size containers.
- **Delimited** with `⟦…⟧`, so a label assembled from fragments shows up as
  several runs instead of one. `countPseudoRuns` turns that into an
  assertion.

Placeholders (`{count}`, `%s`, `<tag>`), digits and punctuation are left
alone, so a pseudo-localized screen is still reviewable. The transform is
pure and deterministic, so tests assert on it exactly rather than eyeballing
it.

`en-XA` is the conventional tag for this and is a **test** locale:
`resolveLocale` never resolves to it, and it is never offered to users.

## What the tests cover

| File | Covers |
| --- | --- |
| `tests/i18n/pseudo-locale.test.ts` | The transform: expansion ratio, accenting, placeholder preservation, run counting, determinism. |
| `tests/i18n/formatting.test.ts` | Every helper against explicit locales, including plural categories in a language that has more than two. |
| `tests/i18n/conventions.test.ts` | Source scan of `app/` and `components/` for bare `toLocale*`, hard-coded locale tags, raw `Intl` use, and fragment concatenation. |
| `tests/i18n/pseudo-locale-rendering.test.tsx` | Representative route and components rendered with expanded text: clipping, fixed widths, accessible names, fragment detection. |

### Scope of the rendering checks

The rendering tests run in jsdom, which does not compute layout, so they
assert on the *declared* layout constraints — a capped height combined with
`overflow-hidden`, an ellipsis or `nowrap` utility on real prose, a fixed
width around user text — rather than on measured pixels. That is enough to
catch the class of bug this issue is about, and it runs deterministically in
the normal `npm test`.

Pixel-level behaviour at browser zoom and with enlarged text is a real-browser
concern and belongs to the accessibility browser suite, not here.

The first thing these checks caught was real: the FAQ accordion clamped an
open answer to `max-h-96` with `overflow-hidden`, which silently cuts a
longer answer off with no way to scroll to the rest. Fixed in
`app/faq/page.tsx`.
