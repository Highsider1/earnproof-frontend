import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { BackfillManagement } from "@/components/payment-backfill/backfill-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function PaymentBackfillPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Request bounded re-synchronization of payments over a specific date range."
          eyebrow="Administration"
          title="Payment Backfill"
        />
        <BackfillManagement />
      </section>
    </PublicShell>
  );
}
