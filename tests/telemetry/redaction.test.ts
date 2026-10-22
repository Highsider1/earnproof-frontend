/**
 * Redaction contract: no sensitive value from a representative browser
 * error may survive into a reportable message shape, and what does survive
 * must still be useful for telling failures apart.
 */

import {
  MAX_MESSAGE_SHAPE_LENGTH,
  redactMessage,
  toEventTimestamp,
} from "@/lib/telemetry/redact";
import {
  REPRESENTATIVE_ERRORS,
  SENSITIVE_VALUES,
  WALLET_ADDRESS,
  BEARER_TOKEN,
  FULL_URL,
  PROOF_ID,
  EMAIL,
} from "./fixtures/sensitive-values";

describe("redactMessage", () => {
  it.each(REPRESENTATIVE_ERRORS)(
    "strips every sensitive value from: $label",
    ({ error }) => {
      const shape = redactMessage(error.message);
      for (const value of SENSITIVE_VALUES) {
        expect(shape).not.toContain(value);
      }
    },
  );

  it("replaces each sensitive shape with a named placeholder", () => {
    expect(redactMessage(`account ${WALLET_ADDRESS} rejected`)).toBe("account <address> rejected");
    expect(redactMessage(`bearer ${BEARER_TOKEN} expired`)).toBe("bearer <token> expired");
    expect(redactMessage(`GET ${FULL_URL} failed`)).toBe("GET <url> failed");
    expect(redactMessage(`proof ${PROOF_ID} missing`)).toBe("proof <proof-id> missing");
    expect(redactMessage(`mail ${EMAIL} bounced`)).toBe("mail <email> bounced");
  });

  it("drops any JSON-shaped payload wholesale", () => {
    const shape = redactMessage('Invalid credential: {"credentialSubject":{"income":"4200.00"}}');
    expect(shape).toBe("Invalid credential: <object>");
  });

  it("keeps enough signal to distinguish two different failures", () => {
    expect(redactMessage("Failed to fetch")).toBe("Failed to fetch");
    expect(redactMessage("Unexpected token < in JSON at position 0")).toBe(
      "Unexpected token < in JSON at position 0",
    );
    expect(redactMessage("Failed to fetch")).not.toBe(
      redactMessage("Unexpected token < in JSON at position 0"),
    );
  });

  it("preserves short numbers that carry diagnostic value", () => {
    expect(redactMessage("EarnProof API request failed with 503")).toContain("503");
  });

  it("caps the message shape length", () => {
    const shape = redactMessage("boundary ".repeat(200));
    expect(shape.length).toBeLessThanOrEqual(MAX_MESSAGE_SHAPE_LENGTH);
  });

  it("does not inspect or coerce non-string input", () => {
    expect(redactMessage(undefined)).toBe("");
    expect(redactMessage(null)).toBe("");
    expect(redactMessage({ walletAddress: WALLET_ADDRESS })).toBe("");
    expect(redactMessage(12345)).toBe("");
  });
});

describe("toEventTimestamp", () => {
  it("truncates to the minute so a timestamp cannot single out a session", () => {
    expect(toEventTimestamp(new Date("2026-08-28T14:37:52.481Z"))).toBe("2026-08-28T14:37:00.000Z");
  });

  it("produces the same value for two errors in the same minute", () => {
    expect(toEventTimestamp(new Date("2026-08-28T14:37:01.000Z"))).toBe(
      toEventTimestamp(new Date("2026-08-28T14:37:59.999Z")),
    );
  });
});
