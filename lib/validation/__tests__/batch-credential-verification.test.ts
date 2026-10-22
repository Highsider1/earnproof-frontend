import {
  acceptBatchItem,
  checkBatchFile,
  MAX_BATCH_ITEMS,
  MAX_BATCH_TOTAL_BYTES,
} from "../batch-credential-verification";

describe("acceptBatchItem", () => {
  it("accepts valid credential JSON with a unique id", () => {
    const result = acceptBatchItem(JSON.stringify({ id: "proof-1" }), []);
    expect(result).toEqual({ ok: true, id: "proof-1" });
  });

  it("rejects malformed JSON", () => {
    const result = acceptBatchItem("not json", []);
    expect(result).toEqual({ ok: false, reason: "malformed" });
  });

  it("rejects JSON missing an id", () => {
    const result = acceptBatchItem(JSON.stringify({ foo: "bar" }), []);
    expect(result).toEqual({ ok: false, reason: "missing-id" });
  });

  it("rejects a duplicate id already in the batch", () => {
    const result = acceptBatchItem(JSON.stringify({ id: "proof-1" }), ["proof-1"]);
    expect(result).toEqual({ ok: false, reason: "duplicate" });
  });

  it("accepts a different id even if another id is already present", () => {
    const result = acceptBatchItem(JSON.stringify({ id: "proof-2" }), ["proof-1"]);
    expect(result).toEqual({ ok: true, id: "proof-2" });
  });
});

describe("checkBatchFile", () => {
  const validFile = { name: "credential.json", size: 1024, type: "application/json" };

  it("accepts a valid file within batch limits", () => {
    expect(checkBatchFile(validFile, 0, 0)).toEqual({ ok: true });
  });

  it("rejects when the batch is already at MAX_BATCH_ITEMS", () => {
    expect(checkBatchFile(validFile, MAX_BATCH_ITEMS, 0)).toEqual({ ok: false, reason: "too-many-items" });
  });

  it("rejects when adding the file would exceed MAX_BATCH_TOTAL_BYTES", () => {
    const result = checkBatchFile(validFile, 1, MAX_BATCH_TOTAL_BYTES - 100);
    expect(result).toEqual({ ok: false, reason: "batch-too-large" });
  });

  it("still applies the per-file oversized check", () => {
    const oversized = { ...validFile, size: 40 * 1024 };
    expect(checkBatchFile(oversized, 0, 0)).toEqual({ ok: false, reason: "oversized" });
  });

  it("still applies the per-file unsupported-type check", () => {
    const wrongType = { name: "credential.txt", size: 1024, type: "text/plain" };
    expect(checkBatchFile(wrongType, 0, 0)).toEqual({ ok: false, reason: "unsupported-type" });
  });

  it("still applies the per-file empty check", () => {
    const empty = { ...validFile, size: 0 };
    expect(checkBatchFile(empty, 0, 0)).toEqual({ ok: false, reason: "empty" });
  });

  it("allows a file that exactly fills the remaining batch budget", () => {
    const result = checkBatchFile(validFile, 1, MAX_BATCH_TOTAL_BYTES - validFile.size);
    expect(result).toEqual({ ok: true });
  });
});
