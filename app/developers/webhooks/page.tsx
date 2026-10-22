import { WebhookManagement } from "@/components/webhooks/webhook-management";
import { PublicShell } from "@/components/layout/public-shell";
import { PageHeading } from "@/components/common/page-heading";

export default function WebhooksPage() {
  return (
    <PublicShell>
      <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <PageHeading
          title="Webhook Management"
          description="Create and manage webhook endpoints to receive real-time events about proofs."
        />

        <WebhookManagement />
      </div>
    </PublicShell>
  );
}
