import { toRoutePattern } from "@/lib/diagnostics/sanitize";

/**
 * A single, already-sanitized diagnostics data point. This is the only
 * shape that ever leaves this module — nothing upstream of `sanitizeMetric`
 * (wallet addresses, proof IDs, credential contents, payment data, raw
 * URLs/query strings) is present on it.
 */
export type WebVitalMetricPayload = {
  metric: string;
  value: number;
  rating: "good" | "needs-improvement" | "poor" | "unknown";
  route: string;
  navigationType: string;
};

export type RawWebVitalMetric = {
  name: string;
  value: number;
  rating?: string;
  navigationType?: string;
};

/**
 * Strip a raw `next/web-vitals` metric + the current pathname down to the
 * privacy-safe payload defined above.
 *
 * Explicitly excluded on purpose, even though `next/web-vitals` sometimes
 * makes it available on the metric object: `metric.id` is a per-page-load
 * random identifier, not a user identifier, but is dropped anyway because
 * this reporter has no legitimate use for it and every dropped field is one
 * fewer thing to audit later. `entries` (raw PerformanceEntry objects) is
 * dropped because it can reference DOM nodes / element attributes that may
 * contain user-entered values (e.g. the proof ID or credential JSON typed
 * into the verification forms).
 */
export function sanitizeMetric(
  metric: RawWebVitalMetric,
  pathname: string,
): WebVitalMetricPayload {
  return {
    metric: metric.name,
    value: roundMetricValue(metric.value),
    rating: isKnownRating(metric.rating) ? metric.rating : "unknown",
    route: toRoutePattern(pathname),
    navigationType: metric.navigationType ?? "unknown",
  };
}

function isKnownRating(
  rating: string | undefined,
): rating is "good" | "needs-improvement" | "poor" {
  return rating === "good" || rating === "needs-improvement" || rating === "poor";
}

// Web Vitals values are sub-millisecond-precise; round to keep payloads
// small and to avoid the false precision of reporting fractional
// milliseconds, without changing which "rating" bucket a value falls in.
function roundMetricValue(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * The actual "sink" a real deployment would wire up. This repo has no
 * analytics backend yet, so this is intentionally a documented no-op in
 * development and a `navigator.sendBeacon` call in production guarded by an
 * opt-in endpoint — wiring a real backend later is a one-line change:
 * set `NEXT_PUBLIC_WEB_VITALS_ENDPOINT` to a same-origin or CORS-enabled
 * collection endpoint that accepts this payload shape as a JSON POST body.
 */
export function sendWebVital(payload: WebVitalMetricPayload): void {
  if (process.env.NODE_ENV !== "production") {
    console.debug("[web-vitals]", payload);
    return;
  }

  const endpoint = process.env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT;
  if (!endpoint || typeof navigator === "undefined" || !navigator.sendBeacon) {
    return;
  }

  const body = new Blob([JSON.stringify(payload)], { type: "application/json" });
  navigator.sendBeacon(endpoint, body);
}
