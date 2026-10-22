/**
 * @jest-environment jsdom
 *
 * Proves the support diagnostics bundle never contains a sensitive value,
 * even when one is fed in through an untrusted-looking path (a health
 * response echoing something it shouldn't). Uses the same fixture battery
 * the telemetry redaction contract is proven against.
 */

import { buildSupportBundle } from "@/lib/diagnostics/supportBundle";
import { SENSITIVE_VALUES } from "../telemetry/fixtures/sensitive-values";
import { resetPageLoadId } from "@/lib/telemetry/correlation";

describe("support diagnostics bundle sensitive-value scan", () => {
  beforeEach(() => {
    resetPageLoadId();
  });

  it("never contains any known-sensitive value in a normal bundle", async () => {
    const bundle = await buildSupportBundle({ pathname: "/faq" });
    const serialized = JSON.stringify(bundle);

    for (const sensitive of SENSITIVE_VALUES) {
      expect(serialized).not.toContain(sensitive);
    }
  });

  it("never passes an arbitrary health response value through, even if it echoes a sensitive value", async () => {
    for (const sensitive of SENSITIVE_VALUES) {
      const bundle = await buildSupportBundle({
        pathname: "/status",
        fetchHealth: async () => ({ status: sensitive }),
      });
      expect(bundle.health.status).toBe("unknown");
    }
  });

  it("never contains a full URL with a query string", async () => {
    const bundle = await buildSupportBundle({
      pathname: "/verify?proof=EP-8A42-91DC&token=abc123",
    });
    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("proof=EP-8A42-91DC");
    expect(serialized).not.toContain("token=abc123");
  });

  it("never contains a proof id in the route field for a dynamic verify path", async () => {
    const bundle = await buildSupportBundle({ pathname: "/verify/EP-9Z11-4402" });
    expect(bundle.route).not.toContain("EP-9Z11-4402");
  });
});
