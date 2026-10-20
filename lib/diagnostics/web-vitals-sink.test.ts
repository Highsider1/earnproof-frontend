import { sanitizeMetric } from "@/lib/diagnostics/web-vitals-sink";

describe("sanitizeMetric", () => {
  it("keeps only the metric name, value, rating, route pattern, and navigation type", () => {
    const payload = sanitizeMetric(
      { name: "LCP", value: 1234.5678, rating: "good", navigationType: "navigate" },
      "/verify",
    );

    expect(payload).toEqual({
      metric: "LCP",
      value: 1234.568,
      rating: "good",
      route: "/verify",
      navigationType: "navigate",
    });
  });

  it("normalizes an unknown rating instead of forwarding an arbitrary string", () => {
    const payload = sanitizeMetric(
      { name: "CLS", value: 0.02, rating: "not-a-real-rating" },
      "/",
    );

    expect(payload.rating).toBe("unknown");
  });

  // Privacy negative fixture: raw metric objects from real usage carry a
  // pathname that may include a proof id or wallet address in the URL
  // (e.g. "/verify?proof=EP-8A42-91DC"). The sanitized payload must never
  // contain that raw value.
  it("never forwards a raw pathname/query string carrying proof or wallet data", () => {
    const payload = sanitizeMetric(
      { name: "INP", value: 180, rating: "good" },
      "/verify?proof=EP-8A42-91DC&wallet=GDQNY3PBOJOKYZSRMK2S3IQ2GKVPPLCACRV",
    );

    expect(payload.route).toBe("/verify");
    expect(JSON.stringify(payload)).not.toContain("EP-8A42-91DC");
    expect(JSON.stringify(payload)).not.toContain("GDQNY3PBOJOKYZSRMK2S3IQ2GKVPPLCACRV");
  });

  it("only ever exposes the fields defined on WebVitalMetricPayload", () => {
    const payload = sanitizeMetric(
      { name: "FID", value: 10, rating: "good", navigationType: "reload" },
      "/proofs",
    );

    expect(Object.keys(payload).sort()).toEqual(
      ["metric", "navigationType", "rating", "route", "value"].sort(),
    );
  });
});
