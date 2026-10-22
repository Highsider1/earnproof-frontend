import { parseBatchProofInput, MAX_BATCH_ITEMS } from "../batch-proof-verification";

describe("parseBatchProofInput", () => {
  it("parses a single valid identifier", () => {
    const rows = parseBatchProofInput("proof-abc123");
    expect(rows).toEqual([{ raw: "proof-abc123", normalizedId: "proof-abc123", status: "VALID_ID" }]);
  });

  it("parses multiple identifiers, one per line", () => {
    const rows = parseBatchProofInput("proof-1\nproof-2\nproof-3");
    expect(rows.map((row) => row.normalizedId)).toEqual(["proof-1", "proof-2", "proof-3"]);
  });

  it("ignores blank lines", () => {
    const rows = parseBatchProofInput("proof-1\n\n\nproof-2");
    expect(rows).toHaveLength(2);
  });

  it("marks an identifier with invalid characters as INVALID_ID", () => {
    const rows = parseBatchProofInput("has spaces and $ymbols!");
    expect(rows[0].status).toBe("INVALID_ID");
    expect(rows[0].normalizedId).toBeNull();
  });

  it("marks a duplicate identifier as DUPLICATE, keeping the first as VALID_ID", () => {
    const rows = parseBatchProofInput("proof-1\nproof-1");
    expect(rows[0].status).toBe("VALID_ID");
    expect(rows[1].status).toBe("DUPLICATE");
  });

  it("extracts a proof id from a full verification URL", () => {
    const rows = parseBatchProofInput("https://example.com/verify/proof-abc123");
    expect(rows[0].normalizedId).toBe("proof-abc123");
    expect(rows[0].status).toBe("VALID_ID");
  });

  it("mixes valid, invalid, and duplicate rows without one affecting another's status", () => {
    const rows = parseBatchProofInput("proof-1\nbad id!\nproof-1\nproof-2");
    expect(rows.map((row) => row.status)).toEqual(["VALID_ID", "INVALID_ID", "DUPLICATE", "VALID_ID"]);
  });

  it("caps the batch at MAX_BATCH_ITEMS lines", () => {
    const lines = Array.from({ length: MAX_BATCH_ITEMS + 10 }, (_, i) => `proof-${i}`);
    const rows = parseBatchProofInput(lines.join("\n"));
    expect(rows).toHaveLength(MAX_BATCH_ITEMS);
  });

  it("returns an empty array for empty input", () => {
    expect(parseBatchProofInput("")).toEqual([]);
  });

  it("returns an empty array for whitespace-only input", () => {
    expect(parseBatchProofInput("   \n  \n")).toEqual([]);
  });
});
