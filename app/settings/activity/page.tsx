import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { ActivityLogGate } from "@/components/activity/activity-log-gate";

export default function ActivityPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Review recent authentication, key, session, and administrative events on your account."
          eyebrow="Administration"
          title="Account activity"
        />
        <ActivityLogGate />
      </section>
    </PublicShell>
  );
}
