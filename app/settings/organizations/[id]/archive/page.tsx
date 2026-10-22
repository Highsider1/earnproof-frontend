"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeading } from "@/components/common/page-heading";
import { pageContainer } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { OrganizationArchivalWorkflow } from "@/components/organizations/organization-archival-workflow";
import { getOrganization } from "@/lib/api/organizations";
import { getIssuers } from "@/lib/api/issuers";
import type { Organization, Issuer } from "@/lib/api/generated/v1";
import { readStoredSession } from "@/lib/session";

export default function OrganizationArchivePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const session = readStoredSession();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [issuers, setIssuers] = useState<Issuer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const loading = Boolean(session) && isFetching;

  useEffect(() => {
    if (!session) {
      return;
    }

    let active = true;
    void Promise.resolve().then(async () => {
      const controller = new AbortController();
      try {
        const [org, issuerList] = await Promise.all([
          getOrganization(session.token, params.id, controller.signal),
          getIssuers(session.token, controller.signal),
        ]);
        if (active) {
          setOrganization(org);
          setIssuers(issuerList);
        }
      } catch {
        if (active) {
          setError("Could not load organization details.");
        }
      } finally {
        if (active) {
          setIsFetching(false);
        }
      }
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id, session?.token]);

  return (
    <PublicShell>
      <section className={`${pageContainer} gap-8 sm:gap-10`}>
        <PageHeading
          description="Export organization data and review blocking resources before archiving."
          eyebrow="Administration"
          title="Archive Organization"
        />

        {!session && (
          <p className="text-sm text-slate-300">Sign in to manage this organization.</p>
        )}

        {session && loading && <p className="text-sm text-slate-300">Loading...</p>}

        {session && error && (
          <p className="text-sm text-rose-200" role="alert">
            {error}
          </p>
        )}

        {session && organization && (
          <OrganizationArchivalWorkflow
            key={organization.id}
            organization={organization}
            issuers={issuers}
            token={session.token}
            userId={session.user.id}
            onArchived={(updated) => {
              setOrganization(updated);
              router.push("/settings/organizations");
            }}
          />
        )}
      </section>
    </PublicShell>
  );
}
