import { toSafeExternalHref } from "@/lib/validation/external-url";

/**
 * Networks the app knows how to build a stellar.expert link for (#137).
 * Anything else is rejected rather than guessed at: a `network` value from
 * API data (`ProofSummary.network`, a free-form string in the OpenAPI
 * schema) is not something this app should ever turn into an href on
 * faith.
 */
const EXPLORER_BASE_BY_NETWORK: Record<string, string> = {
  testnet: "https://stellar.expert/explorer/testnet",
  public: "https://stellar.expert/explorer/public",
};

/**
 * A Stellar transaction hash: exactly 64 lowercase hex characters. Rejects
 * anything shorter/longer, uppercase, or containing non-hex characters
 * before it is ever interpolated into a URL.
 */
const TX_HASH_PATTERN = /^[a-f0-9]{64}$/;

export type ExplorerLinkResult =
  | { ok: true; href: string }
  | { ok: false; reason: "unsupported-network" | "malformed-identifier" };

/**
 * Normalizes a `ProofSummary.network` value ("Stellar Testnet", "testnet",
 * "TESTNET", ...) to the key `EXPLORER_BASE_BY_NETWORK` is keyed on.
 */
function normalizeNetwork(network: string): string {
  const lower = network.trim().toLowerCase();
  if (lower.includes("public") || lower.includes("mainnet")) return "public";
  if (lower.includes("testnet")) return "testnet";
  return lower;
}

/**
 * Builds a validated stellar.expert transaction link, or explains why one
 * couldn't be built. Both the network and the identifier are validated
 * independently before any URL is constructed; a malformed identifier is
 * rejected even for a supported network, and vice versa.
 */
export function buildTransactionExplorerLink(
  network: string,
  transactionHash: string,
): ExplorerLinkResult {
  const base = EXPLORER_BASE_BY_NETWORK[normalizeNetwork(network)];
  if (!base) {
    return { ok: false, reason: "unsupported-network" };
  }

  const hash = transactionHash.trim().toLowerCase();
  if (!TX_HASH_PATTERN.test(hash)) {
    return { ok: false, reason: "malformed-identifier" };
  }

  const candidate = `${base}/tx/${hash}`;
  const safe = toSafeExternalHref(candidate, {
    allowedOrigins: ["https://stellar.expert"],
    requireHttps: true,
  });

  if (!safe.ok) {
    // Defensive: base/hash are both already validated above, so this
    // should be unreachable, but never silently hand back an
    // unvalidated href if toSafeExternalHref disagrees for any reason.
    return { ok: false, reason: "malformed-identifier" };
  }

  return { ok: true, href: safe.href };
}
