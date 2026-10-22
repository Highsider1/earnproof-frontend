import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { EmployerPaymentProofWizard } from "@/components/proofs/employer-payment-proof-wizard";
import { PublicShell } from "@/components/layout/public-shell";

export default function EmployerPaymentProofPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Select an eligible, trusted employer source and a bounded period, then create a minimal-disclosure proof of payment that never reveals exact amounts or transaction details."
          eyebrow="Worker flow"
          title="Create Employer Payment Proof"
        />
        <EmployerPaymentProofWizard />
      </section>
    </PublicShell>
  );
}
