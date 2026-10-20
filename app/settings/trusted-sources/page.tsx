import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { TrustedSourceManagement } from "@/components/trusted-sources/trusted-source-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function TrustedSourcesPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Manage trusted sources and their linked issuer identities."
          eyebrow="Administration"
          title="Trusted Source Management"
        />
        <TrustedSourceManagement />
      </section>
    </PublicShell>
  );
}
