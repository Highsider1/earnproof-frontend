export const appConfig = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1",
  stellarNetwork: process.env.NEXT_PUBLIC_STELLAR_NETWORK ?? "testnet",
  stellarNetworkPassphrase:
    process.env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
    "Test SDF Network ; September 2015",
  stellarHorizonUrl:
    process.env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
    "https://horizon-testnet.stellar.org",
  helpUrl: process.env.NEXT_PUBLIC_HELP_URL ?? "https://help.earnproof.com",
  stellarExplorerUrl: process.env.NEXT_PUBLIC_STELLAR_EXPLORER_URL,
  /**
   * The public key (StrKey "G..." address) the deployment-metadata document
   * (lib/deployment/deployment-metadata.ts) must be signed by. This is the
   * operator's own signing key for *this deployment's* metadata, distinct
   * from any Stellar account used elsewhere in the app - it has no funds and
   * signs nothing on-chain. There is no default: an empty value means no key
   * is configured, and verification must fail closed rather than silently
   * skip the check.
   */
  deploymentMetadataSignerPublicKey:
    process.env.NEXT_PUBLIC_DEPLOYMENT_METADATA_SIGNER_KEY ?? "",
  /** This build's own artifact version, compared against the signed document's. */
  artifactVersion: process.env.NEXT_PUBLIC_ARTIFACT_VERSION ?? "",
  /**
   * Contract addresses this deployment expects to be talking to, compared
   * against the signed document's own list. Comma-separated in the env var
   * since NEXT_PUBLIC_* values are plain strings.
   */
  expectedContractAddresses: (process.env.NEXT_PUBLIC_EXPECTED_CONTRACT_ADDRESSES ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean),
} as const;
