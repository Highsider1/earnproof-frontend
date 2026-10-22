import { FeatureGrid, MarketingHero, pageContainer } from "@/components/common/production-ui";
import { PageHeading } from "@/components/common/page-heading";
import { PublicShell } from "@/components/layout/public-shell";

const features = [
  { title: "Connect safely", description: "Approve a readable wallet challenge; EarnProof never requests a seed phrase or custody permission." },
  { title: "Choose qualifying payments", description: "Select only eligible records and review exclusions before they contribute to a proof." },
  { title: "Share only the claim", description: "Preview every disclosed field, hide exact amounts, and confirm the claim before sharing." },
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading title="How EarnProof works" description="A clear path from wallet payments to a portable, privacy-preserving credential." />
        <MarketingHero title="How EarnProof works" description="A clear path from wallet payments to a portable, privacy-preserving credential." action="See proof types" href="/proofs" />
        <FeatureGrid items={features} />
      </div>
    </PublicShell>
  );
}
