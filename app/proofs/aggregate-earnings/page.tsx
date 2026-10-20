import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { AggregateEarningsProofWizard } from "@/components/proofs/aggregate-earnings-proof-wizard";
import { PublicShell } from "@/components/layout/public-shell";

export default function AggregateEarningsProofPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Select eligible sources and an aggregation policy to create a verifiable proof of combined earnings without disclosing individual payment amounts."
          eyebrow="Worker flow"
          title="Create Aggregate Earnings Proof"
        />
        <AggregateEarningsProofWizard />
      </section>
    </PublicShell>
  );
}
