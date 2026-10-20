import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { BatchProofWorkspace } from "@/components/verification/batch-proof-workspace";

export default function BatchProofVerificationPage() {
  return (
    <PublicShell>
      <section className={pageContainer}>
        <PageHeading
          description="Check multiple proof identifiers at once, review normalized identifiers and duplicates before submitting, and export ordered results."
          title="Batch proof verification"
        />
        <BatchProofWorkspace />
      </section>
    </PublicShell>
  );
}
