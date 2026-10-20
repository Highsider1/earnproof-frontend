import {
  listRenewalLinks,
  findSuccessorOf,
  findPredecessorOf,
  recordRenewal,
  DuplicateSuccessorError,
  RenewalCycleError,
} from "../store";

const USER_A = "user-a";
const USER_B = "user-b";

beforeEach(() => {
  window.localStorage.clear();
});

describe("proof-renewal store", () => {
  it("returns an empty list initially", () => {
    expect(listRenewalLinks(USER_A)).toEqual([]);
  });

  it("records a renewal link", () => {
    const link = recordRenewal(USER_A, "proof-1", "proof-2");

    expect(link.predecessorId).toBe("proof-1");
    expect(link.successorId).toBe("proof-2");
  });

  it("finds the successor of a predecessor", () => {
    recordRenewal(USER_A, "proof-1", "proof-2");

    const successor = findSuccessorOf(USER_A, "proof-1");
    expect(successor?.successorId).toBe("proof-2");
  });

  it("finds the predecessor of a successor", () => {
    recordRenewal(USER_A, "proof-1", "proof-2");

    const predecessor = findPredecessorOf(USER_A, "proof-2");
    expect(predecessor?.predecessorId).toBe("proof-1");
  });

  it("returns null when a proof has no successor", () => {
    expect(findSuccessorOf(USER_A, "unrelated-proof")).toBeNull();
  });

  it("returns null when a proof has no predecessor", () => {
    expect(findPredecessorOf(USER_A, "unrelated-proof")).toBeNull();
  });

  it("rejects renewing the same predecessor a second time (duplicate successor case)", () => {
    recordRenewal(USER_A, "proof-1", "proof-2");

    expect(() => recordRenewal(USER_A, "proof-1", "proof-3")).toThrow(DuplicateSuccessorError);
  });

  it("rejects a proof renewing itself (trivial cycle)", () => {
    expect(() => recordRenewal(USER_A, "proof-1", "proof-1")).toThrow(RenewalCycleError);
  });

  it("rejects a two-hop cycle (A renews to B, then B renews back to A)", () => {
    recordRenewal(USER_A, "proof-a", "proof-b");

    expect(() => recordRenewal(USER_A, "proof-b", "proof-a")).toThrow(RenewalCycleError);
  });

  it("rejects a longer cycle (A -> B -> C -> A)", () => {
    recordRenewal(USER_A, "proof-a", "proof-b");
    recordRenewal(USER_A, "proof-b", "proof-c");

    expect(() => recordRenewal(USER_A, "proof-c", "proof-a")).toThrow(RenewalCycleError);
  });

  it("allows a valid chain of renewals (A -> B -> C, no cycle)", () => {
    recordRenewal(USER_A, "proof-a", "proof-b");

    expect(() => recordRenewal(USER_A, "proof-b", "proof-c")).not.toThrow();
  });

  it("scopes renewal links per user", () => {
    recordRenewal(USER_A, "proof-1", "proof-2");

    expect(findSuccessorOf(USER_B, "proof-1")).toBeNull();
  });

  it("discards a corrupted (non-array) stored value instead of throwing", () => {
    window.localStorage.setItem(
      "earnproof.proof-renewals.user-a",
      JSON.stringify({ not: "array" }),
    );

    expect(listRenewalLinks(USER_A)).toEqual([]);
  });
});
