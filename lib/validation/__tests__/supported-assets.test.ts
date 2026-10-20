import {
  createSupportedAssetSchema,
  isNativeAssetCode,
  assetIdentityKey,
} from "../supported-assets";

describe("createSupportedAssetSchema", () => {
  it("accepts the native asset (XLM) with no issuer", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "XLM",
      assetIssuer: "",
      network: "testnet",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid issued asset with a well-formed issuer", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(true);
  });

  it("rejects XLM with an issuer supplied (negative case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "XLM",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a non-native asset with no issuer (negative case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "USDC",
      assetIssuer: "",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed issuer address (wrong prefix)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "USDC",
      assetIssuer: "A5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVNX",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an issuer address that is too short (boundary case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "USDC",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4K",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 1-character asset code (boundary case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "A",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a 12-character asset code (boundary case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "ABCDEFGHIJKL",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a 13-character asset code (boundary case)", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "ABCDEFGHIJKLM",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an asset code with special characters", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "USD-C",
      assetIssuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
      network: "testnet",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid network value", () => {
    const result = createSupportedAssetSchema.safeParse({
      assetCode: "XLM",
      assetIssuer: "",
      network: "devnet",
    });
    expect(result.success).toBe(false);
  });
});

describe("isNativeAssetCode", () => {
  it("treats XLM as native", () => {
    expect(isNativeAssetCode("XLM")).toBe(true);
  });

  it("treats NATIVE as native, case-insensitively", () => {
    expect(isNativeAssetCode("native")).toBe(true);
  });

  it("does not treat an issued asset code as native", () => {
    expect(isNativeAssetCode("USDC")).toBe(false);
  });
});

describe("assetIdentityKey", () => {
  it("produces the same key for the same network+code+issuer", () => {
    const a = assetIdentityKey({ network: "testnet", assetCode: "USDC", assetIssuer: "GISS" });
    const b = assetIdentityKey({ network: "testnet", assetCode: "usdc", assetIssuer: "GISS" });
    expect(a).toBe(b);
  });

  it("produces different keys for different networks", () => {
    const a = assetIdentityKey({ network: "testnet", assetCode: "USDC", assetIssuer: "GISS" });
    const b = assetIdentityKey({ network: "mainnet", assetCode: "USDC", assetIssuer: "GISS" });
    expect(a).not.toBe(b);
  });

  it("produces different keys for different issuers", () => {
    const a = assetIdentityKey({ network: "testnet", assetCode: "USDC", assetIssuer: "GISS1" });
    const b = assetIdentityKey({ network: "testnet", assetCode: "USDC", assetIssuer: "GISS2" });
    expect(a).not.toBe(b);
  });

  it("normalizes native assets to the same key regardless of a stray issuer field", () => {
    const a = assetIdentityKey({ network: "testnet", assetCode: "XLM" });
    const b = assetIdentityKey({ network: "testnet", assetCode: "XLM", assetIssuer: "" });
    expect(a).toBe(b);
  });
});
