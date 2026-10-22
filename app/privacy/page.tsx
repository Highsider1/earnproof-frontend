import { PageHeading } from "@/components/common/page-heading";
import { pageContainer, StatusBadge } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";

const details = [
  ["Organization", "Veridatum Labs"],
  ["Registry", "Active"],
  ["Wallet", "GBC4…8X2K"],
  ["Verified", "12 Jul 2026"],
  ["Attestations", "Payment and employment"],
];

export default function PrivacyPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading title="Privacy policy" description="Understand what EarnProof processes, stores, discloses, and never collects." />
        <section className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-6">
          <div className="mb-[18px] flex items-start gap-3">
            <h2 className="flex-1 text-2xl font-semibold leading-8">Privacy policy</h2>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>
          <dl className="grid gap-3">
            {details.map(([label, value]) => (
              <div className="grid gap-1 border border-white/10 p-3 text-sm sm:min-h-11 sm:grid-cols-[260px_1fr] sm:items-center sm:gap-2 sm:p-2" key={label}>
                <dt className="text-slate-300">{label}</dt>
                <dd className="text-white">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-[18px] rounded-lg border border-white/15 bg-slate-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Disclosure summary</p>
            <p className="mt-1.5 text-sm leading-5 text-slate-300">No hidden transaction history or exact balance is disclosed.</p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
