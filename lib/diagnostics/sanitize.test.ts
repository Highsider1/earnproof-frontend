import { toRoutePattern } from "@/lib/diagnostics/sanitize";

describe("toRoutePattern", () => {
  it("passes through known static routes", () => {
    expect(toRoutePattern("/")).toBe("/");
    expect(toRoutePattern("/verify")).toBe("/verify");
    expect(toRoutePattern("/verify/credential")).toBe("/verify/credential");
    expect(toRoutePattern("/verify/scan")).toBe("/verify/scan");
    expect(toRoutePattern("/proofs")).toBe("/proofs");
  });

  it("strips trailing slashes before matching", () => {
    expect(toRoutePattern("/verify/")).toBe("/verify");
  });

  // Privacy-safe diagnostics negative fixture: a URL carrying a proof id,
  // wallet address, or any other high-cardinality value must never be
  // reported verbatim. Anything not on the known-route allow-list collapses
  // to "/other".
  it("collapses unrecognized/high-cardinality paths to /other instead of passing them through", () => {
    expect(toRoutePattern("/verify/EP-8A42-91DC")).toBe("/other");
    expect(
      toRoutePattern("/proofs/GDQNY3PBOJOKYZSRMK2S3IQ2GKVPPLCACRV/create"),
    ).toBe("/other");
    expect(toRoutePattern("/verify/credential/9f2c1e")).toBe("/other");
  });

  it("ignores query strings and fragments entirely, even when they carry sensitive data", () => {
    expect(
      toRoutePattern("/verify?proof=EP-8A42-91DC&wallet=GDQNY3PBOJOKYZSRMK2S3IQ2GKVPPLCACRV"),
    ).toBe("/verify");
    expect(toRoutePattern("/verify#credentialHash=abc123")).toBe("/verify");
  });
});
