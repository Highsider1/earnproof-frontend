import { isAuthRecent, isTypedConfirmationValid, RECENT_AUTH_WINDOW_MS } from "../organization-archival";

describe("isAuthRecent", () => {
  it("returns false when there is no prior verification", () => {
    expect(isAuthRecent(null)).toBe(false);
  });

  it("returns true immediately after verification", () => {
    const now = Date.now();
    expect(isAuthRecent(new Date(now).toISOString(), now)).toBe(true);
  });

  it("returns true just under the window", () => {
    const now = Date.now();
    const verifiedAt = new Date(now - RECENT_AUTH_WINDOW_MS + 1000).toISOString();
    expect(isAuthRecent(verifiedAt, now)).toBe(true);
  });

  it("returns false just over the window", () => {
    const now = Date.now();
    const verifiedAt = new Date(now - RECENT_AUTH_WINDOW_MS - 1000).toISOString();
    expect(isAuthRecent(verifiedAt, now)).toBe(false);
  });

  it("returns false for a verification from a long time ago", () => {
    const now = Date.now();
    const verifiedAt = new Date(now - 60 * 60 * 1000).toISOString();
    expect(isAuthRecent(verifiedAt, now)).toBe(false);
  });
});

describe("isTypedConfirmationValid", () => {
  it("returns true for an exact match", () => {
    expect(isTypedConfirmationValid("Acme Corp", "Acme Corp")).toBe(true);
  });

  it("returns false for a case mismatch", () => {
    expect(isTypedConfirmationValid("acme corp", "Acme Corp")).toBe(false);
  });

  it("returns false for a partial match", () => {
    expect(isTypedConfirmationValid("Acme", "Acme Corp")).toBe(false);
  });

  it("returns false for an empty value", () => {
    expect(isTypedConfirmationValid("", "Acme Corp")).toBe(false);
  });

  it("returns false for trailing whitespace", () => {
    expect(isTypedConfirmationValid("Acme Corp ", "Acme Corp")).toBe(false);
  });
});
