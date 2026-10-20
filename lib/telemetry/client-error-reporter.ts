/**
 * Building and transporting client error events.
 *
 * Two invariants hold everywhere in this file:
 *
 * 1. **Nothing that is not in the schema allow-list can leave.** Events are
 *    built from redacted parts and projected through `serializeEvent`
 *    immediately before transport.
 * 2. **Telemetry never changes the user's workflow.** Every entry point is
 *    synchronous, returns `void` or a boolean, and swallows every error it
 *    can produce — a broken collector, a blocked beacon, a browser without
 *    `navigator.sendBeacon`, or an exception thrown from inside `JSON`
 *    serialization. Diagnostics that can break the product they diagnose are
 *    worse than no diagnostics.
 *
 * No telemetry vendor is required: the transport is a fire-and-forget POST
 * to an opt-in same-origin endpoint, exactly like `lib/diagnostics`.
 */

import { toRoutePattern } from "@/lib/diagnostics/sanitize";
import { generateCorrelationId, getPageLoadId } from "./correlation";
import { redactMessage, toEventTimestamp } from "./redact";
import { resolveSampleRate, shouldSample, type SamplingConfig } from "./sampling";
import {
  SCHEMA_VERSION,
  serializeEvent,
  toAllowedErrorName,
  type ClientErrorEvent,
  type ErrorCategory,
  type ErrorSeverity,
} from "./schema";

export type ReportInput = {
  error: unknown;
  category: ErrorCategory;
  severity?: ErrorSeverity;
  /** Raw pathname; reduced to a route pattern. Query strings are dropped. */
  pathname: string;
};

export type ReporterOptions = {
  endpoint?: string;
  release?: string;
  sampling?: SamplingConfig;
  random?: () => number;
  now?: number | Date;
  /** Injected for tests; defaults to `navigator.sendBeacon`. */
  transport?: (endpoint: string, body: string) => boolean;
};

/**
 * Map an error (and, for API failures, the response that produced it) onto
 * the stable category vocabulary. Categories come from the *shape* of the
 * failure, never from its message, so the mapping cannot be perturbed by
 * user-controlled text.
 */
export function categorizeError(error: unknown, response?: { status: number }): ErrorCategory {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "api.cancelled";
  }
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "api.timeout";
  }

  if (response) {
    if (response.status === 429) return "api.rate-limited";
    if (response.status === 408 || response.status === 504) return "api.timeout";
    if (response.status >= 500) return "api.server-error";
    if (response.status >= 400) return "api.client-error";
  }

  if (error instanceof TypeError) {
    return "api.network-unavailable";
  }

  return "unknown";
}

/**
 * Build a complete, already-redacted event. Exported so tests (and any
 * future transport) can inspect exactly what would be sent without sending
 * anything.
 */
export function buildClientErrorEvent(
  input: ReportInput,
  options: ReporterOptions = {},
): ClientErrorEvent {
  const error = input.error;
  const name = error instanceof Error ? error.name : undefined;
  const message = error instanceof Error ? error.message : undefined;

  return {
    schemaVersion: SCHEMA_VERSION,
    category: input.category,
    severity: input.severity ?? "error",
    route: toRoutePattern(input.pathname),
    occurredAt: toEventTimestamp(options.now),
    correlationId: generateCorrelationId(),
    pageLoadId: getPageLoadId(),
    errorName: toAllowedErrorName(name),
    messageShape: redactMessage(message),
    release: options.release ?? defaultRelease(),
    sampleRate: resolveSampleRate(input.category, options.sampling ?? defaultSampling()),
  };
}

function defaultRelease(): string {
  return process.env.NEXT_PUBLIC_RELEASE ?? "unknown";
}

function defaultSampling(): SamplingConfig {
  const raw = process.env.NEXT_PUBLIC_ERROR_TELEMETRY_SAMPLE_RATE;
  return { defaultRate: raw === undefined ? 0 : Number(raw) };
}

/**
 * Default transport: a fire-and-forget beacon, which the browser delivers
 * outside the page's lifetime and which cannot block navigation or unload.
 * Any failure — no `navigator`, no `sendBeacon`, a browser that throws on a
 * blocked request — is contained here and reported as `false`.
 */
function beaconTransport(endpoint: string, body: string): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
      return false;
    }
    const blob = new Blob([body], { type: "application/json" });
    return navigator.sendBeacon(endpoint, blob);
  } catch {
    return false;
  }
}

/**
 * Report a client error.
 *
 * Returns `true` only when an event was actually handed to the transport,
 * which is what the tests assert on; callers in the app ignore the result.
 * This function never throws and never returns a promise, so no caller can
 * accidentally await it or have their control flow diverted by it.
 */
export function reportClientError(input: ReportInput, options: ReporterOptions = {}): boolean {
  try {
    const endpoint = options.endpoint ?? process.env.NEXT_PUBLIC_ERROR_TELEMETRY_ENDPOINT;
    if (!endpoint) {
      return false;
    }

    const sampling = options.sampling ?? defaultSampling();
    if (!shouldSample(input.category, sampling, options.random)) {
      return false;
    }

    const event = buildClientErrorEvent(input, { ...options, sampling });
    const body = JSON.stringify(serializeEvent(event as unknown as Record<string, unknown>));
    const transport = options.transport ?? beaconTransport;
    return transport(endpoint, body) === true;
  } catch {
    // Deliberately swallowed. A telemetry failure must be invisible to the
    // user workflow that triggered it; there is nothing useful to do here
    // and re-throwing would turn a diagnostic into an outage.
    return false;
  }
}
