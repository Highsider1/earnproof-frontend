/**
 * Scoped 404 for everything under `/embed/` (e.g. an unsupported widget
 * version such as `/embed/v2/verify/...`, or a malformed embed path).
 * Next.js renders the nearest `not-found.tsx` up the route tree, so this
 * takes over from the global `app/not-found.tsx` for this route family.
 *
 * Deliberately does NOT use `PublicShell` (full nav chrome makes no sense
 * inside a small relying-party-embedded iframe) and stays visually
 * consistent with the widget's own error states
 * (`components/verification/embed/verification-widget.tsx`) rather than
 * the marketing-styled global 404.
 */
export default function EmbedNotFound() {
  return (
    <div className="flex min-h-screen items-start justify-center bg-slate-950 p-3 sm:p-4">
      <main aria-label="EarnProof proof verification" id="main-content">
        <div
          className="grid min-h-[120px] w-full max-w-[420px] gap-1 rounded-lg border border-white/10 bg-slate-950 p-4 text-white"
          role="alert"
        >
          <p className="text-sm font-semibold text-rose-200">Verification widget not found</p>
          <p className="text-xs leading-5 text-slate-400">
            This embed link is unsupported or no longer available.
          </p>
        </div>
      </main>
    </div>
  );
}
