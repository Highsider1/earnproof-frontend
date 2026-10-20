import {
  ALLOWED_CREDENTIAL_MIME_TYPES,
  MAX_CREDENTIAL_FILE_BYTES,
  checkCredentialFile,
  parseCredentialJson,
} from "@/lib/validation/credential-import";

function fileMeta(overrides: Partial<{ name: string; size: number; type: string }> = {}) {
  return {
    name: "credential.json",
    size: 512,
    type: "application/json",
    ...overrides,
  };
}

describe("credential-import validation", () => {
  describe("checkCredentialFile", () => {
    it("accepts a well-formed .json file within the size limit", () => {
      expect(checkCredentialFile(fileMeta())).toEqual({ ok: true });
    });

    it("accepts a .json file with no reported MIME type", () => {
      expect(checkCredentialFile(fileMeta({ type: "" }))).toEqual({ ok: true });
    });

    it("accepts every allowlisted MIME type", () => {
      for (const type of ALLOWED_CREDENTIAL_MIME_TYPES) {
        expect(checkCredentialFile(fileMeta({ type }))).toEqual({ ok: true });
      }
    });

    it("rejects files over the byte limit (boundary: exactly one byte over)", () => {
      expect(
        checkCredentialFile(fileMeta({ size: MAX_CREDENTIAL_FILE_BYTES + 1 })),
      ).toEqual({ ok: false, reason: "oversized" });
    });

    it("accepts a file exactly at the byte limit (boundary)", () => {
      expect(checkCredentialFile(fileMeta({ size: MAX_CREDENTIAL_FILE_BYTES }))).toEqual({
        ok: true,
      });
    });

    it("rejects empty files", () => {
      expect(checkCredentialFile(fileMeta({ size: 0 }))).toEqual({
        ok: false,
        reason: "empty",
      });
    });

    it("rejects unsupported extensions regardless of MIME type", () => {
      expect(
        checkCredentialFile(fileMeta({ name: "credential.exe", type: "application/json" })),
      ).toEqual({ ok: false, reason: "unsupported-type" });
      expect(
        checkCredentialFile(fileMeta({ name: "credential.json.exe" })),
      ).toEqual({ ok: false, reason: "unsupported-type" });
    });

    it("rejects a .json-named file whose MIME type is not on the allowlist", () => {
      expect(
        checkCredentialFile(fileMeta({ type: "application/x-msdownload" })),
      ).toEqual({ ok: false, reason: "unsupported-type" });
    });

    it("is case-insensitive on the extension", () => {
      expect(checkCredentialFile(fileMeta({ name: "CREDENTIAL.JSON" }))).toEqual({
        ok: true,
      });
    });
  });

  describe("parseCredentialJson", () => {
    it("extracts the id field from valid credential JSON", () => {
      expect(parseCredentialJson(JSON.stringify({ id: "cred-1", other: "ignored" }))).toEqual({
        ok: true,
        id: "cred-1",
      });
    });

    it("trims surrounding whitespace before parsing", () => {
      expect(parseCredentialJson(`  ${JSON.stringify({ id: "cred-1" })}  \n`)).toEqual({
        ok: true,
        id: "cred-1",
      });
    });

    it("rejects empty or whitespace-only input", () => {
      expect(parseCredentialJson("")).toEqual({ ok: false, reason: "malformed" });
      expect(parseCredentialJson("   ")).toEqual({ ok: false, reason: "malformed" });
    });

    it("rejects malformed JSON without throwing", () => {
      expect(() => parseCredentialJson("{not json")).not.toThrow();
      expect(parseCredentialJson("{not json")).toEqual({ ok: false, reason: "malformed" });
    });

    it("rejects JSON arrays and primitives", () => {
      expect(parseCredentialJson("[1,2,3]")).toEqual({ ok: false, reason: "malformed" });
      expect(parseCredentialJson("42")).toEqual({ ok: false, reason: "malformed" });
      expect(parseCredentialJson('"just a string"')).toEqual({ ok: false, reason: "malformed" });
      expect(parseCredentialJson("null")).toEqual({ ok: false, reason: "malformed" });
    });

    it("rejects an object with a missing id", () => {
      expect(parseCredentialJson(JSON.stringify({ notId: "x" }))).toEqual({
        ok: false,
        reason: "missing-id",
      });
    });

    it("rejects an object with a non-string or empty id", () => {
      expect(parseCredentialJson(JSON.stringify({ id: 123 }))).toEqual({
        ok: false,
        reason: "missing-id",
      });
      expect(parseCredentialJson(JSON.stringify({ id: "" }))).toEqual({
        ok: false,
        reason: "missing-id",
      });
      expect(parseCredentialJson(JSON.stringify({ id: "   " }))).toEqual({
        ok: false,
        reason: "missing-id",
      });
    });
  });
});
