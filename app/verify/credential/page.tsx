import { Suspense } from "react";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { VerifyCredentialForm } from "@/components/verification/verify-credential-form";

export default function VerifyCredentialPage() {
  return (
    <PublicShell>
      <section className={pageContainer}>
        <PageHeading
          description="Validate a signed EarnProof JSON credential without exposing unrelated wallet data."
          title="Upload credential"
        />
        <Suspense
          fallback={
            <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-sm text-slate-300">
              Loading verification form...
            </div>
          }
        >
          <VerifyCredentialForm />
        </Suspense>
      </section>
    </PublicShell>
  );
}
