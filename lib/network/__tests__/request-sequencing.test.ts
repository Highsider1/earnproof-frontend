import { describe, it, expect, beforeEach } from "vitest";
import { RequestSequencer, SequencedResource } from "../request-sequencing";

describe("RequestSequencer", () => {
  let sequencer: RequestSequencer;

  beforeEach(() => {
    sequencer = new RequestSequencer();
  });

  describe("beginRequest", () => {
    it("returns monotonically increasing IDs", () => {
      const id1 = sequencer.beginRequest();
      const id2 = sequencer.beginRequest();
      const id3 = sequencer.beginRequest();

      expect(id1).toBeLessThan(id2);
      expect(id2).toBeLessThan(id3);
    });
  });

  describe("isCurrent", () => {
    it("returns true for the latest request ID", () => {
      const id1 = sequencer.beginRequest();
      const id2 = sequencer.beginRequest();

      expect(sequencer.isCurrent(id1)).toBe(false);
      expect(sequencer.isCurrent(id2)).toBe(true);
    });

    it("returns false for older request IDs", () => {
      const id1 = sequencer.beginRequest();
      const id2 = sequencer.beginRequest();
      const id3 = sequencer.beginRequest();

      expect(sequencer.isCurrent(id1)).toBe(false);
      expect(sequencer.isCurrent(id2)).toBe(false);
      expect(sequencer.isCurrent(id3)).toBe(true);
    });
  });

  describe("recordResponse", () => {
    it("accepts newer responses", () => {
      const id1 = sequencer.beginRequest();
      const result = { data: "test" };

      const accepted = sequencer.recordResponse(id1, result);

      expect(accepted).toBe(true);
      expect(sequencer.getLatestResult()).toEqual(result);
    });

    it("rejects stale responses (older IDs)", () => {
      const id1 = sequencer.beginRequest();
      const id2 = sequencer.beginRequest();

      sequencer.recordResponse(id2, { data: "newer" });
      const accepted = sequencer.recordResponse(id1, { data: "stale" });

      expect(accepted).toBe(false);
      expect(sequencer.getLatestResult()).toEqual({ data: "newer" });
    });

    it("rejects out-of-order responses by timestamp", () => {
      const id1 = sequencer.beginRequest();
      const oldTimestamp = Date.now() - 1000;
      const newTimestamp = Date.now();

      sequencer.recordResponse(id1, { data: "newer" }, newTimestamp);
      const accepted = sequencer.recordResponse(id1, { data: "stale" }, oldTimestamp);

      expect(accepted).toBe(false);
      expect(sequencer.getLatestResult()).toEqual({ data: "newer" });
    });

    it("handles response ordering correctly in fast sequences", () => {
      const id1 = sequencer.beginRequest();
      const id2 = sequencer.beginRequest();

      // B arrives first
      const b_accepted = sequencer.recordResponse(id2, { data: "B" }, 100);
      // A arrives late
      const a_accepted = sequencer.recordResponse(id1, { data: "A" }, 200);

      expect(b_accepted).toBe(true);
      expect(a_accepted).toBe(false); // Stale, rejected
      expect(sequencer.getLatestResult()).toEqual({ data: "B" });
    });
  });

  describe("reset", () => {
    it("clears state", () => {
      const id1 = sequencer.beginRequest();
      sequencer.recordResponse(id1, { data: "test" });

      sequencer.reset();

      const id2 = sequencer.beginRequest();
      expect(sequencer.isCurrent(id1)).toBe(false);
      expect(sequencer.isCurrent(id2)).toBe(true);
      expect(sequencer.getLatestResult()).toBeUndefined();
    });
  });
});

describe("SequencedResource", () => {
  let resource: SequencedResource<{ data: string }>;

  beforeEach(() => {
    resource = new SequencedResource();
  });

  it("tracks cache alongside sequencing", () => {
    const id1 = resource.beginRequest();
    resource.recordResponse(id1, { data: "test" });

    expect(resource.getCache()).toEqual({ data: "test" });
  });

  it("invalidates cache and sequencer together", () => {
    const id1 = resource.beginRequest();
    resource.recordResponse(id1, { data: "test" });

    resource.invalidate();

    expect(resource.getCache()).toBeUndefined();
    const id2 = resource.beginRequest();
    expect(resource.isCurrent(id1)).toBe(false);
  });

  it("prevents stale responses from updating cache", () => {
    const id1 = resource.beginRequest();
    const id2 = resource.beginRequest();

    resource.recordResponse(id2, { data: "new" });
    const old_accepted = resource.recordResponse(id1, { data: "old" });

    expect(old_accepted).toBe(false);
    expect(resource.getCache()).toEqual({ data: "new" });
  });
});
