export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: "wallet" | "privacy" | "verification" | "testnet" | "issuer" | "expiration";
}

export const faqData: FAQItem[] = [
  // WALLET SAFETY
  {
    id: "wallet-safety-1",
    question: "Is my wallet safe to use with EarnProof?",
    answer:
      "Freighter keeps your keys local. EarnProof cannot move funds or recover seed phrases. Only public keys are shared.",
    category: "wallet",
  },
  {
    id: "wallet-safety-2",
    question: "Does EarnProof store my wallet keys?",
    answer: "No. EarnProof is non-custodial. Keys never leave your device.",
    category: "wallet",
  },

  // HIDDEN DATA / PRIVACY
  {
    id: "privacy-1",
    question: "What data does EarnProof store about me?",
    answer:
      "Only the proof you choose to share. No raw credentials, IP addresses, or wallet activity are stored.",
    category: "privacy",
  },
  {
    id: "privacy-2",
    question: "Can verifiers see my full financial history?",
    answer:
      "No. Proofs disclose only what the issuer attested — nothing more.",
    category: "privacy",
  },

  // EXPIRATION AND REVOCATION
  {
    id: "expiration-1",
    question: "Can a proof expire?",
    answer:
      "Yes. Issuers set expiry dates. An expired proof returns EXPIRED status on verification.",
    category: "expiration",
  },
  {
    id: "expiration-2",
    question: "What happens if a proof is revoked?",
    answer: "Verification returns REVOKED. The proof can no longer be used.",
    category: "expiration",
  },

  // TESTNET
  {
    id: "testnet-1",
    question: "Is EarnProof on mainnet?",
    answer:
      "EarnProof currently operates on Stellar testnet. Do not use mainnet assets or make mainnet promises.",
    category: "testnet",
  },
  {
    id: "testnet-2",
    question: "When will mainnet launch?",
    answer:
      "No mainnet date is announced. All current proofs are testnet only.",
    category: "testnet",
  },

  // VERIFICATION
  {
    id: "verification-1",
    question: "How does proof verification work?",
    answer:
      "The verifier checks the proof signature, issuer trust, and expiry on-chain via Stellar references.",
    category: "verification",
  },
  {
    id: "verification-2",
    question: "What proof types are supported?",
    answer:
      "Only proof types documented in the EarnProof protocol are supported. No unsupported types are accepted.",
    category: "verification",
  },

  // ISSUER TRUST
  {
    id: "issuer-1",
    question: "How do I know an issuer is trustworthy?",
    answer:
      "Check the issuer's DID and trust registry listing. EarnProof surfaces issuer-warning status when an issuer is not in a trusted registry.",
    category: "issuer",
  },
  {
    id: "issuer-2",
    question: "Can anyone issue proofs?",
    answer:
      "Any party can create an issuer DID but verification outcomes reflect issuer trust level.",
    category: "issuer",
  },
];

export const faqCategories = [
  "wallet",
  "privacy",
  "verification",
  "testnet",
  "issuer",
  "expiration",
] as const;

export function getCategoryLabel(
  category: (typeof faqCategories)[number]
): string {
  const labels: Record<string, string> = {
    wallet: "Wallet Safety",
    privacy: "Privacy & Data",
    verification: "Verification",
    testnet: "Testnet",
    issuer: "Issuer Trust",
    expiration: "Expiration & Revocation",
  };
  return labels[category];
}
