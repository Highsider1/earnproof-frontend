import Link from "next/link";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer, FeatureGrid, StatusBadge } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";

export const metadata = {
  title: "Security | EarnProof",
  description: "Learn about the security controls and cryptographic standards protecting EarnProof.",
};

const implementedControls = [
  {
    title: "Wallet authentication",
    description: "Sign in securely using your digital wallet, ensuring you have exclusive control over your account access.",
  },
  {
    title: "Selective disclosure",
    description: "Reveal only what is strictly necessary. You remain in control, hiding exact balances and detailed transaction history.",
  },
  {
    title: "Protected payment data",
    description: "Your payment details are protected using verifiable HMAC credentials, preventing unauthorized data exposure.",
  },
  {
    title: "Digital signing",
    description: "All proofs and credentials use digital signatures to ensure data integrity, authenticity, and non-repudiation.",
  },
  {
    title: "Revocation",
    description: "Users and issuers maintain the ability to quickly and securely revoke previously issued proofs and credentials.",
  },
  {
    title: "Optional Stellar anchoring",
    description: "Optionally anchor proofs to the Stellar network for decentralized public verifiability. This operates independently of our core HMAC credential system.",
  },
];

const recommendations = [
  {
    title: "Responsible disclosure",
    description: "If you believe you have found a security vulnerability in our platform, please practice responsible disclosure and report it to our team immediately.",
  },
  {
    title: "Key management",
    description: "Maintain the physical and digital security of your wallet and private keys, as they are your primary method of authentication.",
  },
];

export default function SecurityPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading 
          title="Security" 
          description="How EarnProof protects your payment data, identity, and proofs using modern cryptographic standards." 
        />
        
        <div className="mt-8 flex flex-col gap-8">
          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Implemented controls</h2>
              <StatusBadge tone="success">Active</StatusBadge>
            </div>
            <FeatureGrid items={implementedControls} />
          </section>

          <section>
            <div className="mb-4 flex items-center gap-3">
              <h2 className="text-xl font-semibold text-white">Recommendations</h2>
              <StatusBadge tone="warning">Advisory</StatusBadge>
            </div>
            <FeatureGrid items={recommendations} />
          </section>

          <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-6">
            <h2 className="mb-3 text-xl font-semibold text-white">Related information</h2>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-cyan-300 hover:text-cyan-200 underline focus:outline-none focus:ring-2 focus:ring-cyan-300 rounded">
                Privacy policy
              </Link>
              <Link href="/status" className="text-cyan-300 hover:text-cyan-200 underline focus:outline-none focus:ring-2 focus:ring-cyan-300 rounded">
                System status
              </Link>
            </div>
          </section>
        </div>
      </div>
    </PublicShell>
  );
}
