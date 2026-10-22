import { DataPanel, MetricGrid, pageContainer } from "@/components/common/production-ui";
import { PageHeading } from "@/components/common/page-heading";
import { PublicShell } from "@/components/layout/public-shell";

const rows = [
  { primary: "Veridatum Labs", secondary: "Registry verified", tertiary: "Today", status: "Active" },
  { primary: "Stellar Community Fund", secondary: "Registry verified", tertiary: "Aug 17", status: "Active" },
  { primary: "Anchor Payroll", secondary: "Review pending", tertiary: "Aug 16", status: "Review", tone: "warning" as const },
  { primary: "Open Work Network", secondary: "Registry verified", tertiary: "Aug 15", status: "Active" },
];

export default function IssuersPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading title="Issuer directory" description="Find registered organizations that can issue trusted payment attestations." />
        <MetricGrid items={[{ value: "18", label: "Verified issuers" }, { value: "16", label: "Active issuers" }, { value: "7", label: "Attestation types" }]} />
        <DataPanel headers={["Issuer", "Verification", "Reviewed", "Status"]} rows={rows} searchPlaceholder="Search issuer directory" />
      </div>
    </PublicShell>
  );
}
