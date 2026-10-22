import {
  listWalletRotations,
  isWalletAlreadyAssigned,
  completeWalletRotation,
  areBothChallengesValid,
  WalletAlreadyAssignedError,
} from "../store";

beforeEach(() => {
  window.localStorage.clear();
});

describe("wallet-rotation store", () => {
  it("returns an empty list initially", () => {
    expect(listWalletRotations()).toEqual([]);
  });

  it("completes a rotation and records it", () => {
    const record = completeWalletRotation("GOLDWALLET", "GNEWWALLET");

    expect(record.previousAddress).toBe("GOLDWALLET");
    expect(record.newAddress).toBe("GNEWWALLET");
    expect(listWalletRotations()).toHaveLength(1);
  });

  it("reports a rotated-into address as already assigned (negative case)", () => {
    completeWalletRotation("GOLDWALLET", "GNEWWALLET");

    expect(isWalletAlreadyAssigned("GNEWWALLET")).toBe(true);
  });

  it("does not report an unused address as assigned", () => {
    expect(isWalletAlreadyAssigned("GUNUSED")).toBe(false);
  });

  it("does not report a vacated (previous) address as assigned, allowing its reuse", () => {
    completeWalletRotation("GOLDWALLET", "GNEWWALLET");

    expect(isWalletAlreadyAssigned("GOLDWALLET")).toBe(false);
  });

  it("rejects completing a rotation into an already-assigned address (conflict case)", () => {
    completeWalletRotation("GWALLET1", "GSHARED");

    expect(() => completeWalletRotation("GWALLET2", "GSHARED")).toThrow(
      WalletAlreadyAssignedError,
    );
  });

  it("allows chained rotations into previously-vacated addresses", () => {
    completeWalletRotation("GWALLET1", "GWALLET2");

    expect(() => completeWalletRotation("GWALLET2", "GWALLET3")).not.toThrow();
  });
});

describe("areBothChallengesValid", () => {
  const NOW = Date.parse("2026-06-15T12:00:00.000Z");

  it("is true when both challenges are still within their expiry window", () => {
    expect(
      areBothChallengesValid(
        "2026-06-15T12:05:00.000Z",
        "2026-06-15T12:10:00.000Z",
        NOW,
      ),
    ).toBe(true);
  });

  it("is false when the current-wallet challenge has expired (boundary/expiry case)", () => {
    expect(
      areBothChallengesValid(
        "2026-06-15T11:55:00.000Z",
        "2026-06-15T12:10:00.000Z",
        NOW,
      ),
    ).toBe(false);
  });

  it("is false when the replacement-wallet challenge has expired", () => {
    expect(
      areBothChallengesValid(
        "2026-06-15T12:05:00.000Z",
        "2026-06-15T11:55:00.000Z",
        NOW,
      ),
    ).toBe(false);
  });

  it("is false at the exact expiry instant (strictly-before semantics)", () => {
    expect(
      areBothChallengesValid(
        "2026-06-15T12:00:00.000Z",
        "2026-06-15T12:10:00.000Z",
        NOW,
      ),
    ).toBe(false);
  });

  it("is false for an unparsable expiry timestamp", () => {
    expect(areBothChallengesValid("garbage", "2026-06-15T12:10:00.000Z", NOW)).toBe(
      false,
    );
  });
});
