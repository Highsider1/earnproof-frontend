"use client";

import { useParams } from "next/navigation";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { ProofSharingPanel } from "@/components/proofs/proof-sharing-panel";
import { readStoredSession } from "@/lib/session";

export default function ProofSharePage() {
  const params = useParams<{ id: string }>();
  const session = readStoredSession();

  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Create, review, copy, and revoke time-limited, disclosure-limited links for sharing this proof."
          eyebrow="Proof sharing"
          title="Share this proof"
        />

        {!session ? (
          <p className="text-sm text-slate-300">Sign in to manage sharing for this proof.</p>
        ) : (
          <ProofSharingPanel proofId={params.id} userId={session.user.id} />
        )}
      </section>
    </PublicShell>
  );
}
