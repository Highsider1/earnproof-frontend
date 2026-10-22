/**
 * @jest-environment jsdom
 */

import {
  buildSupportBundle,
  OPTIONAL_SUPPORT_BUNDLE_FIELDS,
} from "./supportBundle";
import { resetPageLoadId } from "@/lib/telemetry/correlation";

describe("buildSupportBundle", () => {
  beforeEach(() => {
    resetPageLoadId();
  });

  it("includes an app version, route pattern, and correlation id", async () => {
    const bundle = await buildSupportBundle({ pathname: "/faq" });

    expect(typeof bundle.appVersion).toBe("string");
    expect(bundle.appVersion.length).toBeGreaterThan(0);
    expect(bundle.route).toBe("/faq");
    expect(typeof bundle.correlationId).toBe("string");
    expect(bundle.correlationId).toHaveLength(32);
  });

  it("collapses an unrecognized route to /other rather than leaking the raw path", async () => {
    const bundle = await buildSupportBundle({ pathname: "/verify/EP-8A42-91DC" });
    expect(bundle.route).toBe("/other");
  });

  it("reuses the same correlation id across multiple bundles in one page load", async () => {
    const first = await buildSupportBundle({ pathname: "/faq" });
    const second = await buildSupportBundle({ pathname: "/status" });
    expect(first.correlationId).toBe(second.correlationId);
  });

  it("does not throw and reports health as unknown when the health check fails", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      fetchHealth: async () => {
        throw new Error("network error");
      },
    });

    expect(bundle.health.status).toBe("unknown");
  });

  it("does not throw and reports health as unknown when the health endpoint is unreachable", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      fetchHealth: async () => null,
    });

    expect(bundle.health.status).toBe("unknown");
  });

  it("reports the health status when the check succeeds", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      fetchHealth: async () => ({ status: "ok" }),
    });

    expect(bundle.health.status).toBe("ok");
  });

  it("collapses any non-'ok' health response to 'unknown' rather than passing it through verbatim", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      fetchHealth: async () => ({ status: "degraded: database connection pool exhausted" }),
    });

    expect(bundle.health.status).toBe("unknown");
  });

  it("omits an optional field's real data when it is excluded", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      includeFields: OPTIONAL_SUPPORT_BUNDLE_FIELDS.filter((f) => f !== "health"),
      fetchHealth: async () => ({ status: "ok" }),
    });

    expect(bundle.health.status).toBe("unknown");
  });

  it("omits feature detection when the field is excluded", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/status",
      includeFields: OPTIONAL_SUPPORT_BUNDLE_FIELDS.filter((f) => f !== "features"),
    });

    expect(bundle.features).toEqual({
      clipboard: false,
      camera: false,
      barcodeDetector: false,
      sendBeacon: false,
    });
  });

  it("includes a generatedAt ISO timestamp", async () => {
    const bundle = await buildSupportBundle({ pathname: "/faq" });
    expect(() => new Date(bundle.generatedAt).toISOString()).not.toThrow();
  });
});
