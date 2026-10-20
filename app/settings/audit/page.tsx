import { Suspense } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { AuditLogManagement } from "@/components/audit/audit-log-management";
import { PublicShell } from "@/components/layout/public-shell";

export default function AuditLogPage() {
  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Filter, inspect, verify, and export organization audit records."
          eyebrow="Administration"
          title="Audit Log Explorer"
        />
        <Suspense
          fallback={
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              Loading audit log...
            </div>
          }
        >
          <AuditLogManagement />
        </Suspense>
      </section>
    </PublicShell>
  );
}
