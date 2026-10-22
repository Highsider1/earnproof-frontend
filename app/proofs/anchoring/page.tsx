import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { AnchoringOperationsManagement } from "@/components/proofs/anchoring-operations-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function AnchoringOperationsPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Review failed or quarantined proof anchoring operations, and retry or reconcile them."
          eyebrow="Admin flow"
          title="Anchoring Recovery"
        />
        <AnchoringOperationsManagement />
      </section>
    </PublicShell>
  );
}
