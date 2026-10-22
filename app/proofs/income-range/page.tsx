import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { IncomeRangeProofWizard } from "@/components/proofs/income-range-proof-wizard";
import { PublicShell } from "@/components/layout/public-shell";

export default function IncomeRangeProofPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Prove your income fell within a chosen range over a time period, without disclosing the exact amount."
          eyebrow="Worker flow"
          title="Create Income Range Proof"
        />
        <IncomeRangeProofWizard />
      </section>
    </PublicShell>
  );
}
