import { PageHeading } from "@/components/common/page-heading";
import { pageContainer, StatusBadge } from "@/components/common/production-ui";
import { PublicShell } from "@/components/layout/public-shell";
import { termsSections } from "@/lib/terms";

const EFFECTIVE_DATE_ISO = "2026-07-12";
const EFFECTIVE_DATE_DISPLAY = "12 Jul 2026";

export default function TermsPage() {
  return (
    <PublicShell>
      <div className={pageContainer}>
        <PageHeading
          title="Terms of use"
          description="The conditions, limitations, and responsibilities for using EarnProof."
        />

        <section
          aria-labelledby="terms-heading"
          className="rounded-lg border border-white/10 bg-white/[0.04] p-5 sm:p-6"
        >
          {/* Header row: title + ACTIVE badge */}
          <div className="mb-[18px] flex items-start gap-3">
            <h2
              className="flex-1 text-2xl font-semibold leading-8"
              id="terms-heading"
            >
              Terms of use
            </h2>
            <StatusBadge tone="success">Active</StatusBadge>
          </div>

          {/* Effective date row — mirrors the dl row style from privacy page */}
          <dl className="mb-6 grid gap-3">
            <div className="grid gap-1 border border-white/10 p-3 text-sm sm:min-h-11 sm:grid-cols-[260px_1fr] sm:items-center sm:gap-2 sm:p-2">
              <dt className="text-slate-300">Effective</dt>
              <dd className="text-white">
                <time dateTime={EFFECTIVE_DATE_ISO}>{EFFECTIVE_DATE_DISPLAY}</time>
              </dd>
            </div>
          </dl>

          {/* Section navigation */}
          <nav aria-label="Terms sections" className="mb-8">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Sections
            </p>
            <ul className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
              {termsSections.map((section) => (
                <li key={section.id}>
                  <a
                    className="text-sm text-slate-300 underline-offset-2 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                    href={`#${section.id}`}
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal body — one article per section */}
          <div className="grid gap-8">
            {termsSections.map((section) => (
              <article key={section.id}>
                <h2
                  className="mb-3 text-base font-semibold leading-6 text-white sm:text-lg sm:leading-7"
                  id={section.id}
                >
                  {section.heading}
                </h2>
                <p className="text-sm leading-6 text-slate-300">{section.body}</p>
              </article>
            ))}
          </div>

          {/* Disclosure-style closing panel */}
          <div className="mt-[18px] rounded-lg border border-white/15 bg-slate-300/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              Contact &amp; updates
            </p>
            <p className="mt-1.5 text-sm leading-5 text-slate-300">
              Questions about these Terms?{" "}
              <a
                className="text-cyan-200 underline underline-offset-2 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                href="mailto:legal@earnproof.io"
                rel="noopener noreferrer"
              >
                legal@earnproof.io
              </a>
              . Last updated:{" "}
              <time dateTime={EFFECTIVE_DATE_ISO}>{EFFECTIVE_DATE_DISPLAY}</time>.
            </p>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
