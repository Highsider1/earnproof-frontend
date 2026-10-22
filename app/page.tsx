import { FeatureGrid, MarketingHero, pageContainer } from "@/components/common/production-ui";
import { PageHeading } from "@/components/common/page-heading";
import { PublicShell } from "@/components/layout/public-shell";

const features = [
  { title: "Selective disclosure", description: "Choose the exact claim to share while balances, counterparties, and unrelated transactions remain hidden." },
  { title: "Verified on Stellar", description: "Validate issuer signatures, network references, revocation state, and credential integrity on Stellar." },
  { title: "Portable credentials", description: "Download or share a signed credential that can be verified without returning to EarnProof." },
];

export default function Home() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading title="EarnProof" description="Prove qualifying income without exposing your full financial history." />
        <MarketingHero title="EarnProof" description="Prove qualifying income without exposing your full financial history." action="Create a proof" href="/proofs" />
        <FeatureGrid items={features} />
      </div>
    </PublicShell>
  );
}
