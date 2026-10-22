import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { OrganizationUsageDashboard } from "@/components/settings/organization-usage-dashboard";
import { PublicShell } from "@/components/layout/public-shell";

export default function UsagePage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Track quota usage and request rate limits for API keys, webhooks, proofs, and payment synchronization."
          eyebrow="Administration"
          title="Usage & Quotas"
        />
        <OrganizationUsageDashboard />
      </section>
    </PublicShell>
  );
}
