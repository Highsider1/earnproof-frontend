import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { BatchCredentialWorkspace } from "@/components/verification/batch-credential-workspace";

export default function BatchCredentialVerificationPage() {
  return (
    <PublicShell>
      <section className={pageContainer}>
        <PageHeading
          description="Validate multiple signed EarnProof JSON credentials at once, without uploading unbounded files or losing item-level results."
          title="Batch credential verification"
        />
        <BatchCredentialWorkspace />
      </section>
    </PublicShell>
  );
}
