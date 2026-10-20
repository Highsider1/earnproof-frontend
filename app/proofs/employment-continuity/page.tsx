import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { EmploymentContinuityProofWizard } from "@/components/proofs/employment-continuity-proof-wizard";
import { PublicShell } from "@/components/layout/public-shell";

export default function EmploymentContinuityProofPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Configure a continuity length and gap policy, review period-by-period coverage without exposing individual payments, and create a verifiable employment-continuity proof."
          eyebrow="Worker flow"
          title="Create Employment Continuity Proof"
        />
        <EmploymentContinuityProofWizard />
      </section>
    </PublicShell>
  );
}
