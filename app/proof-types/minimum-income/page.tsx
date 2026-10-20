import Link from "next/link";
import { PageHeading } from "@/components/common/page-heading";
import { StatusBadge, pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";

const disclosedFields = [
  { label: "Threshold", value: "Set when you create the proof" },
  { label: "Asset", value: "USDC (testnet)" },
  { label: "Period", value: "Qualifying payment window" },
  { label: "Payment count", value: "Number of qualifying payments" },
  { label: "Wallet hash", value: "Pseudonymous wallet identifier" },
  { label: "Issued date", value: "When the credential was issued" },
  { label: "Expiry date", value: "When the credential expires" },
  { label: "Status", value: "Active while valid" },
];

const hiddenFields = [
  "Exact total income earned",
  "Individual source transactions",
  "Sender addresses",
  "Wallet balance",
];

export default function MinimumIncomeProofTypePage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <PageHeading
            eyebrow="Proof type"
            title="Minimum Income"
            description="Verifiably prove that your income meets or exceeds a minimum threshold over a period, without revealing your exact earnings or transaction details."
          />
          <div className="shrink-0 sm:pt-1">
            <StatusBadge tone="success">Available</StatusBadge>
          </div>
        </div>

        <div
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-7"
          role="region"
          aria-labelledby="overview-heading"
        >
          <h2 id="overview-heading" className="text-xl font-semibold leading-7 text-white">
            What this proof shows
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            A Minimum Income credential proves to a verifier that you earned at least a chosen
            threshold amount within a specified period. The credential attests to the threshold
            being met while keeping your actual earnings and the underlying payments private.
          </p>
        </div>

        <section
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-7"
          aria-labelledby="details-heading"
        >
          <h2 id="details-heading" className="text-xl font-semibold leading-7 text-white">
            Proof details
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            The following details are disclosed in the credential so a verifier can confirm the
            claim.
          </p>
          <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {disclosedFields.map((field) => (
              <div
                key={field.label}
                className="rounded-lg border border-white/10 bg-white/[0.02] p-4"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {field.label}
                </dt>
                <dd className="mt-1 text-sm text-white">{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-7"
          aria-labelledby="disclosure-heading"
        >
          <h2 id="disclosure-heading" className="text-xl font-semibold leading-7 text-white">
            Disclosure summary
          </h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Minimum Income credentials are designed around selective disclosure. When a verifier
            checks your proof, the following information is never revealed:
          </p>
          <ul className="mt-5 grid gap-3 sm:grid-cols-2">
            {hiddenFields.map((field) => (
              <li
                key={field}
                className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-200"
              >
                <span aria-hidden="true" className="mt-1 text-slate-400">
                  ●
                </span>
                <span>{field}</span>
              </li>
            ))}
          </ul>
        </section>

        <section
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-7"
          aria-labelledby="verification-heading"
        >
          <h2 id="verification-heading" className="text-xl font-semibold leading-7 text-white">
            Verification details
          </h2>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
            Verifiers confirm that the credential is valid, unexpired, issued to the presented
            wallet hash, and that its disclosed threshold was certified against qualifying Stellar
            testnet payments within the stated period.
          </p>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/proofs"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-cyan-300/50 bg-cyan-300 px-6 text-sm font-medium text-slate-950 transition hover:bg-cyan-200"
          >
            Create a minimum income proof
          </Link>
          <Link
            href="/proof-types"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Browse all proof types
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
