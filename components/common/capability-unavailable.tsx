import Link from "next/link";

/**
 * Explicit "this isn't available" state for a capability-gated route or
 * action — shown instead of silently hiding the surrounding page context
 * (per issue #194: "Show an explicit unavailable state instead of hiding
 * required context").
 *
 * Purely presentational: callers decide *when* to render this (via
 * `useCapability`/`useCapabilities`), this component only renders the
 * explanation once that decision has been made.
 */
export function CapabilityUnavailable({
  title = "This feature isn't available yet",
  description = "This part of EarnProof isn't enabled for your account or deployment yet. It may be rolling out gradually, or may require a newer app version.",
  homeHref = "/",
  homeLabel = "Back to EarnProof",
}: {
  title?: string;
  description?: string;
  homeHref?: string;
  homeLabel?: string;
}) {
  return (
    <div
      className="rounded-lg border border-amber-300/30 bg-amber-300/10 p-6"
      role="status"
    >
      <div className="flex items-start gap-3">
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-100"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div>
          <h3 className="text-lg font-semibold text-amber-100">{title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
          <Link
            className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-white/15 px-6 text-sm font-medium text-white transition hover:bg-white/10"
            href={homeHref}
          >
            {homeLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
