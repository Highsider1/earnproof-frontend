import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { WalletRotationManagement } from "@/components/wallet/wallet-rotation-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function WalletSettingsPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Rotate the wallet address associated with your account after a custody change."
          eyebrow="Account"
          title="Wallet Settings"
        />
        <WalletRotationManagement />
      </section>
    </PublicShell>
  );
}
