import {
  listSupportedAssets,
  createSupportedAsset,
  updateSupportedAsset,
  setSupportedAssetStatus,
  DuplicateSupportedAssetError,
  SupportedAssetNotFoundError,
} from "../store";

beforeEach(() => {
  window.localStorage.clear();
});

describe("supported-assets store", () => {
  it("returns an empty list initially", () => {
    expect(listSupportedAssets()).toEqual([]);
  });

  it("creates a native asset with no issuer, defaulting to ACTIVE status", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });

    expect(record.assetCode).toBe("XLM");
    expect(record.assetIssuer).toBeNull();
    expect(record.status).toBe("ACTIVE");
    expect(record.deactivatedAt).toBeNull();
  });

  it("creates an issued asset with its issuer, uppercasing the code", () => {
    const record = createSupportedAsset({
      assetCode: "usdc",
      assetIssuer: "GISSUER",
      network: "testnet",
    });

    expect(record.assetCode).toBe("USDC");
    expect(record.assetIssuer).toBe("GISSUER");
  });

  it("rejects a duplicate network+code+issuer combination before creation", () => {
    createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER", network: "testnet" });

    expect(() =>
      createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER", network: "testnet" }),
    ).toThrow(DuplicateSupportedAssetError);
  });

  it("allows the same code+issuer on a different network", () => {
    createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER", network: "testnet" });

    expect(() =>
      createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER", network: "mainnet" }),
    ).not.toThrow();
    expect(listSupportedAssets()).toHaveLength(2);
  });

  it("allows two different issuers under the same code and network", () => {
    createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER1", network: "testnet" });

    expect(() =>
      createSupportedAsset({ assetCode: "USDC", assetIssuer: "GISSUER2", network: "testnet" }),
    ).not.toThrow();
  });

  it("updates an asset's code", () => {
    const record = createSupportedAsset({ assetCode: "USDX", assetIssuer: "GISSUER", network: "testnet" });

    const updated = updateSupportedAsset(record.id, { assetCode: "usdc" });

    expect(updated.assetCode).toBe("USDC");
  });

  it("throws SupportedAssetNotFoundError updating a missing id", () => {
    expect(() => updateSupportedAsset("missing", { assetCode: "X" })).toThrow(
      SupportedAssetNotFoundError,
    );
  });

  it("deactivates an asset and stamps deactivatedAt", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });

    const updated = setSupportedAssetStatus(record.id, "INACTIVE");

    expect(updated.status).toBe("INACTIVE");
    expect(updated.deactivatedAt).not.toBeNull();
  });

  it("keeps deactivatedAt set after reactivating (historical identifiability)", () => {
    const record = createSupportedAsset({ assetCode: "XLM", network: "testnet" });
    setSupportedAssetStatus(record.id, "INACTIVE");

    const reactivated = setSupportedAssetStatus(record.id, "ACTIVE");

    expect(reactivated.status).toBe("ACTIVE");
    expect(reactivated.deactivatedAt).not.toBeNull();
  });

  it("throws SupportedAssetNotFoundError setting status on a missing id", () => {
    expect(() => setSupportedAssetStatus("missing", "INACTIVE")).toThrow(
      SupportedAssetNotFoundError,
    );
  });

  it("lists assets newest first", () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    try {
      createSupportedAsset({ assetCode: "AAA", assetIssuer: "G1", network: "testnet" });
      jest.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
      const second = createSupportedAsset({ assetCode: "BBB", assetIssuer: "G2", network: "testnet" });

      expect(listSupportedAssets()[0]?.id).toBe(second.id);
    } finally {
      jest.useRealTimers();
    }
  });

  it("discards a corrupted (non-array) stored value instead of throwing", () => {
    window.localStorage.setItem("earnproof.supported-assets", JSON.stringify({ not: "array" }));

    expect(listSupportedAssets()).toEqual([]);
  });

  it("discards malformed entries within an otherwise-valid array", () => {
    window.localStorage.setItem(
      "earnproof.supported-assets",
      JSON.stringify([
        {
          id: "ok",
          assetCode: "XLM",
          assetIssuer: null,
          network: "testnet",
          status: "ACTIVE",
          createdAt: "x",
          updatedAt: "x",
        },
        { garbage: true },
      ]),
    );

    const list = listSupportedAssets();
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("ok");
  });

  it("recovers from non-JSON localStorage content without throwing", () => {
    window.localStorage.setItem("earnproof.supported-assets", "{not json");

    expect(() => listSupportedAssets()).not.toThrow();
  });
});
