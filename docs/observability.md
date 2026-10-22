# Client error telemetry

Operational diagnostics are only useful if they preserve user privacy and
stay stable enough to correlate an incident. This document is the contract
for client error events: what may be reported, what may never be, and what
the tests in `tests/telemetry/` hold us to.

No telemetry vendor is required or assumed. The transport is a
fire-and-forget POST to an opt-in endpoint, and with no endpoint configured
**no event is built and nothing is sent**.

## The event

`lib/telemetry/schema.ts` is the single definition. Every serialized event is
projected onto this allow-list, so a field added anywhere upstream is dropped
rather than transmitted:

| Field | What it is |
| --- | --- |
| `schemaVersion` | Integer, bumped only for a breaking shape change. |
| `category` | One of the stable categories below. |
| `severity` | `"error"` or `"warning"`. |
| `route` | Low-cardinality route pattern from `lib/diagnostics/sanitize.ts`. Never a URL. |
| `occurredAt` | ISO-8601, truncated to the minute. |
| `correlationId` | Opaque random value, one per event. |
| `pageLoadId` | Opaque random value, one per page load. |
| `errorName` | A standard platform error name, or `"Error"`. |
| `messageShape` | Redacted, length-capped shape of the message. |
| `release` | `NEXT_PUBLIC_RELEASE`, or `"unknown"`. |
| `sampleRate` | The rate this event was sampled at, so volume can be reconstructed. |

### Why an allow-list

A deny-list has to anticipate every future leak; an allow-list only has to be
reviewed when someone wants to add a field. Adding a field to
`ALLOWED_EVENT_FIELDS` is therefore the reviewable moment, and
`tests/telemetry/error-event-contract.test.ts` asserts that the serialized
key set is exactly the allow-list.

## What is never reported

- **Wallet addresses, credentials, proof bodies, payment data and tokens.**
  Never collected at any layer, and additionally scrubbed by
  `lib/telemetry/redact.ts` from anything derived from an error message — so
  a leak takes two independent mistakes, not one.
- **Full URLs and query strings.** `/verify?proof=EP-8A42-91DC` is how proof
  IDs travel through this app. Only a route pattern is reported, and an
  unrecognized path collapses to `/other` rather than being sent verbatim.
- **Raw error messages and stack traces.** Messages routinely embed the value
  that caused the failure. Only a redacted shape is sent; stacks are not sent
  at all.
- **User, session, device or wallet identifiers of any kind.**

### Redaction

`redactMessage` does not try to judge whether a message is safe. It rewrites
every recognizable *shape* of sensitive data into a placeholder and caps the
result at 160 characters:

```
"Freighter rejected signing for account GAJD…CYU7"
  -> "Freighter rejected signing for account <address>"

"Invalid credential payload: {\"credentialSubject\":{\"income\":\"4200.00\"}}"
  -> "Invalid credential payload: <object>"

"EarnProof API request failed for https://api…?proofId=EP-8A42-91DC"
  -> "EarnProof API request failed for <url>"
```

What survives is enough to tell two different failures apart — `Failed to
fetch` versus `Unexpected token < in JSON at position 0` — and nothing more.
A non-string value (an object thrown instead of an `Error`) is **not**
coerced and inspected; it collapses to an empty shape, because coercing an
unknown object is exactly how a credential ends up in a log.

## Stable categories

Categories are the vocabulary an on-call responder groups and alerts on, so
they are coarse, product-shaped, and append-only — renaming one breaks
historical correlation, which is the whole point of having them.

```
api.network-unavailable   api.timeout             api.cancelled
api.client-error          api.server-error        api.rate-limited
api.contract-mismatch     input.validation-rejected
wallet.unavailable        wallet.rejected
render.component-error    runtime.unhandled-rejection
runtime.uncaught-error    unknown
```

`categorizeError` derives the category from the **shape** of the failure (the
error type, the HTTP status), never from its message, so user-controlled text
cannot perturb the classification.

## Correlation identifiers

`correlationId` (per event) and `pageLoadId` (per page load) let a responder
group the errors of a single incident and let a user quote an id in a support
request. They are explicitly not identity and not authentication:

- **Not derived from anything.** Generated from a CSPRNG with no input, so
  they cannot be computed from — or reversed to — a wallet, account, proof or
  device. Two events for the identical error carry different ids.
- **Not an authenticator.** Nothing accepts a correlation id as a credential;
  it grants no access and is never sent in an `Authorization` header. Holding
  one proves nothing, which is exactly why it is safe to print.
- **Not persistent.** `pageLoadId` lives in a module-scoped variable and dies
  with the document. It is never written to `localStorage`,
  `sessionStorage`, a cookie, or a URL, so it cannot become a cross-session
  tracking identifier.

## Sampling

Sampling bounds cost and volume. It fails **closed**: any rate that is not a
finite number in `[0, 1]` is treated as `0`, so a misconfigured environment
variable silently disables reporting rather than silently flooding a
collector with user-triggered events. The boundary is `random < rate`, so
`0` never samples and `1` always does. Per-category overrides let a rare,
high-value category be captured in full while a noisy one is throttled.

## Failure isolation

Telemetry must never block or change the user's workflow. Every entry point
is synchronous, returns `void` or a boolean, and swallows everything it can
produce: a browser with no `navigator.sendBeacon`, a beacon the browser
refuses, a collector that is unreachable, a hostile error object that throws
while being inspected. `reportClientError` never throws and never returns a
promise, so no caller can accidentally await it.

`lib/api/client.ts` reports API failures through this path and then rethrows
the **original** error, unchanged, at the same moment it would have without
telemetry. `tests/telemetry/api-integration.test.ts` proves this through the
real beacon transport rather than an injected one.

## Configuration

```
NEXT_PUBLIC_ERROR_TELEMETRY_ENDPOINT=   # unset -> nothing is ever sent
NEXT_PUBLIC_ERROR_TELEMETRY_SAMPLE_RATE=0
NEXT_PUBLIC_RELEASE=
```

Only `NEXT_PUBLIC_*` variables are read, so nothing server-side can be
inlined into the browser bundle by this module.

## Tests

`tests/telemetry/` runs under the normal `npm test`:

| File | Covers |
| --- | --- |
| `redaction.test.ts` | Every representative browser error is stripped of every synthetic sensitive value, and useful signal survives. |
| `error-event-contract.test.ts` | Serialized payloads carry exactly the allow-listed keys; category stability; transport failure isolation. |
| `correlation.test.ts` | Ids are random, underived, unique and never persisted. |
| `sampling.test.ts` | Exact boundaries with an injected random source — no statistical flake. |
| `api-integration.test.ts` | The real `apiClient` path is unaffected by telemetry failing in every way it can. |

Fixtures in `tests/telemetry/fixtures/sensitive-values.ts` are entirely
synthetic; no real wallet, credential, token or payment record appears in
this repository.
