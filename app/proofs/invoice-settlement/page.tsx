import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { InvoiceSettlementProofWizard } from "@/components/proofs/invoice-settlement-proof-wizard";
import { PublicShell } from "@/components/layout/public-shell";

export default function InvoiceSettlementProofPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10 sm:px-36 sm:py-16`}>
        <PageHeading
          description="Bind a private invoice reference to an eligible payment, preview the fields that will be committed, and create a verifiable invoice-settlement proof."
          eyebrow="Worker flow"
          title="Create Invoice Settlement Proof"
        />
        <InvoiceSettlementProofWizard />
      </section>
    </PublicShell>
  );
}
