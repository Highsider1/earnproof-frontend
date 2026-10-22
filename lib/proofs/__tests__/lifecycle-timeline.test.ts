import { buildProofLifecycleTimeline } from "../lifecycle-timeline";

describe("buildProofLifecycleTimeline (#137)", () => {
  it("orders Issued before Verified for a valid proof", () => {
    const events = buildProofLifecycleTimeline({
      result: "VALID",
      issuedAt: "2026-08-01T00:00:00.000Z",
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "verified"]);
  });

  it("orders Issued before Revoked, using revokedAt when present", () => {
    const events = buildProofLifecycleTimeline({
      result: "REVOKED",
      issuedAt: "2026-08-01T00:00:00.000Z",
      revokedAt: "2026-08-10T00:00:00.000Z",
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "revoked"]);
    expect(events[1].at).toBe("2026-08-10T00:00:00.000Z");
  });

  it("orders Issued before Expired, using expiresAt when present", () => {
    const events = buildProofLifecycleTimeline({
      result: "EXPIRED",
      issuedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: "2026-09-01T00:00:00.000Z",
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "expired"]);
  });

  it("orders stably by kind when Issued and Revoked share the exact same timestamp", () => {
    const sameInstant = "2026-08-01T00:00:00.000Z";
    const events = buildProofLifecycleTimeline({
      result: "REVOKED",
      issuedAt: sameInstant,
      revokedAt: sameInstant,
    });

    // Even with identical timestamps, issuance must always precede
    // revocation in the rendered order: causal (kind) order breaks the tie.
    expect(events.map((e) => e.kind)).toEqual(["issued", "revoked"]);
  });

  it("orders stably by kind when a timestamp is absent (revokedAt omitted by the API)", () => {
    const events = buildProofLifecycleTimeline({
      result: "REVOKED",
      issuedAt: "2026-08-01T00:00:00.000Z",
      revokedAt: null,
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "revoked"]);
    expect(events[1].at).toBeNull();
  });

  it("produces the same order across repeated calls with identical input (determinism)", () => {
    const input = {
      result: "REVOKED" as const,
      issuedAt: "2026-08-01T00:00:00.000Z",
      revokedAt: null,
    };

    const first = buildProofLifecycleTimeline(input).map((e) => e.kind);
    const second = buildProofLifecycleTimeline(input).map((e) => e.kind);
    expect(first).toEqual(second);
  });

  it("represents PENDING (unknown proof) explicitly rather than a generic fallback", () => {
    const events = buildProofLifecycleTimeline({ result: "UNKNOWN_PROOF" });
    expect(events).toEqual([
      {
        kind: "pending",
        at: null,
        label: "Not found",
        description: "No lifecycle events are available for an unrecognized proof identifier.",
      },
    ]);
  });

  it("represents a failed signature verification explicitly", () => {
    const events = buildProofLifecycleTimeline({
      result: "INVALID_SIGNATURE",
      issuedAt: "2026-08-01T00:00:00.000Z",
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "failed"]);
  });

  it("represents an unverified issuer explicitly, distinct from an invalid signature", () => {
    const events = buildProofLifecycleTimeline({ result: "UNVERIFIED_ISSUER" });
    expect(events[0].label).toBe("Verification failed");
    expect(events[0].description).toContain("issuer");
  });

  it("adds an upcoming Expires event for a still-valid proof with a future expiresAt", () => {
    const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const events = buildProofLifecycleTimeline({
      result: "VALID",
      issuedAt: "2026-08-01T00:00:00.000Z",
      expiresAt: future,
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "verified", "pending"]);
    expect(events[2].label).toBe("Expires");
  });

  it("does not add an upcoming Expires event when expiresAt is already in the past", () => {
    const past = "2020-01-01T00:00:00.000Z";
    const events = buildProofLifecycleTimeline({
      result: "VALID",
      issuedAt: "2019-01-01T00:00:00.000Z",
      expiresAt: past,
    });

    expect(events.map((e) => e.kind)).toEqual(["issued", "verified"]);
  });

  it("every event carries accessible text beyond just a kind/color", () => {
    const events = buildProofLifecycleTimeline({
      result: "REVOKED",
      issuedAt: "2026-08-01T00:00:00.000Z",
      revokedAt: "2026-08-10T00:00:00.000Z",
    });

    for (const event of events) {
      expect(event.label.length).toBeGreaterThan(0);
      expect(event.description.length).toBeGreaterThan(10);
    }
  });

  it("never includes claim-derived data (income thresholds, wallet hashes) since it is only built from lifecycle timestamps", () => {
    const events = buildProofLifecycleTimeline({
      result: "VALID",
      issuedAt: "2026-08-01T00:00:00.000Z",
    });

    const serialized = JSON.stringify(events);
    expect(serialized).not.toMatch(/wallet|threshold|income|hash/i);
  });

  it("omits the Issued event entirely when issuedAt is not provided, rather than fabricating a timestamp", () => {
    const events = buildProofLifecycleTimeline({ result: "VALID" });
    expect(events.some((e) => e.kind === "issued")).toBe(false);
  });
});
