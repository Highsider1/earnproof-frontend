import { z } from "zod";

/** Stellar public keys start with G and are 56 base32 (RFC 4648, no padding) characters. */
const STELLAR_ISSUER_REGEX = /^G[A-Z2-7]{55}$/;

/** Stellar asset codes: 1-12 alphanumeric characters (alphanum4/alphanum12). */
const ASSET_CODE_REGEX = /^[A-Za-z0-9]{1,12}$/;

export const stellarNetworkSchema = z.enum(["testnet", "mainnet"]);

export const createSupportedAssetSchema = z
  .object({
    assetCode: z
      .string()
      .trim()
      .regex(ASSET_CODE_REGEX, "Asset code must be 1-12 alphanumeric characters"),
    // Native XLM has no issuer; every other asset must supply one. Empty
    // string (not omitted) represents "native" from a controlled form input,
    // so it's normalized to undefined before validation runs.
    assetIssuer: z
      .string()
      .trim()
      .optional()
      .transform((val) => (val === "" ? undefined : val)),
    network: stellarNetworkSchema,
  })
  .refine(
    (data) => {
      const isNative = data.assetCode.toUpperCase() === "XLM" || data.assetCode.toUpperCase() === "NATIVE";
      if (isNative) return data.assetIssuer === undefined;
      return true;
    },
    { message: "The native asset (XLM) cannot have an issuer", path: ["assetIssuer"] },
  )
  .refine(
    (data) => {
      const isNative = data.assetCode.toUpperCase() === "XLM" || data.assetCode.toUpperCase() === "NATIVE";
      if (isNative) return true;
      return data.assetIssuer !== undefined && STELLAR_ISSUER_REGEX.test(data.assetIssuer);
    },
    {
      message: "A non-native asset requires a valid Stellar issuer address (starts with G, 56 characters)",
      path: ["assetIssuer"],
    },
  );

export type CreateSupportedAssetInput = z.infer<typeof createSupportedAssetSchema>;

export function isNativeAssetCode(assetCode: string): boolean {
  const upper = assetCode.toUpperCase();
  return upper === "XLM" || upper === "NATIVE";
}

/**
 * The identity that makes two supported-asset entries "the same asset":
 * network + code + issuer (native assets share the empty-issuer slot).
 * Used to reject duplicate registrations (#156's own acceptance criterion)
 * before submission, not just after a round-trip to the store.
 */
export function assetIdentityKey(entry: {
  network: string;
  assetCode: string;
  assetIssuer?: string | null;
}): string {
  const normalizedIssuer = isNativeAssetCode(entry.assetCode)
    ? ""
    : (entry.assetIssuer ?? "");
  return `${entry.network}:${entry.assetCode.toUpperCase()}:${normalizedIssuer}`;
}
