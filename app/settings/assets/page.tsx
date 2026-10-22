import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { SupportedAssetManagement } from "@/components/supported-assets/supported-asset-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function SupportedAssetsPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Manage which Stellar assets can be indexed and used for proofs."
          eyebrow="Administration"
          title="Supported Asset Administration"
        />
        <SupportedAssetManagement />
      </section>
    </PublicShell>
  );
}
