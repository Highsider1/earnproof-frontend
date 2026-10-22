/**
 * A Stellar asset, as identified by an (assetCode, assetIssuer) pair
 * throughout this codebase's API data (Payment, SignedCredential.claim,
 * aggregate/income-range/recurring-income proof sources, ...). No formal
 * type has existed for this shape before now; those call sites keep their
 * own inline `{ assetCode, assetIssuer }` fields for API-response
 * compatibility, but should treat this as the canonical shape going
 * forward.
 *
 * `assetIssuer === null` means the native asset (XLM); a non-null issuer
 * means an issued asset, keyed by (code, issuer) per the Stellar protocol
 * (the same code can be issued by more than one issuer and those are
 * different assets).
 */
export interface StellarAsset {
  assetCode: string;
  assetIssuer: string | null;
}

/** Stellar amounts (native or issued) are always fixed at 7 decimal places. */
export const STELLAR_ASSET_DECIMALS = 7;

export function isNativeAsset(asset: StellarAsset): boolean {
  return asset.assetIssuer === null;
}

/**
 * A stable identity key for an asset, e.g. for deduping or grouping by
 * asset. Matches the `` `${assetCode}:${assetIssuer ?? "native"}` `` key
 * shape already used ad hoc in lib/api/aggregate-earnings-proofs.ts.
 */
export function assetKey(asset: StellarAsset): string {
  return `${asset.assetCode}:${asset.assetIssuer ?? "native"}`;
}

/**
 * A short, plain-language label distinguishing native from issued assets,
 * e.g. "XLM" vs. "USDC (issued)".
 */
export function assetDisplayLabel(asset: StellarAsset): string {
  return isNativeAsset(asset) ? asset.assetCode : `${asset.assetCode} (issued)`;
}
