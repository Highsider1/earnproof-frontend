import { buildProofLifecycleTimeline, type ProofLifecycleInput } from "@/lib/proofs/lifecycle-timeline";
import { formatDateTime } from "@/lib/i18n";

const KIND_STYLES: Record<
  ReturnType<typeof buildProofLifecycleTimeline>[number]["kind"],
  { dot: string; text: string }
> = {
  issued: { dot: "bg-cyan-300", text: "text-cyan-200" },
  verified: { dot: "bg-emerald-300", text: "text-emerald-200" },
  pending: { dot: "bg-slate-400", text: "text-slate-300" },
  expired: { dot: "bg-amber-300", text: "text-amber-200" },
  revoked: { dot: "bg-rose-300", text: "text-rose-200" },
  failed: { dot: "bg-rose-300", text: "text-rose-200" },
};

/**
 * Renders a proof's lifecycle as an ordered timeline (#137). Every event
 * carries visible text (label + description) in addition to its color
 * dot, so the state is legible without relying on color alone.
 */
export function ProofLifecycleTimeline({ proof }: { proof: ProofLifecycleInput }) {
  const events = buildProofLifecycleTimeline(proof);

  if (events.length === 0) {
    return null;
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <h3 className="text-sm font-semibold text-white">Lifecycle</h3>
      <ol className="mt-4 grid gap-4">
        {events.map((event, index) => {
          const style = KIND_STYLES[event.kind];
          return (
            <li className="flex gap-3" key={`${event.kind}-${index}`}>
              <span
                aria-hidden="true"
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dot}`}
              />
              <div className="min-w-0">
                <p className={`text-sm font-medium ${style.text}`}>
                  {event.label}
                  {event.at ? (
                    <span className="ml-2 text-xs font-normal text-slate-400">
                      {formatDateTime(event.at)}
                    </span>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-slate-400">{event.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
