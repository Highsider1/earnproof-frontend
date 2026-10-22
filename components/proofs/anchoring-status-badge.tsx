import { formatAnchoringStatus, type AnchoringStatus } from "@/lib/api/anchoring";

const statusStyles: Record<AnchoringStatus, { bg: string; text: string; border: string }> = {
  ANCHORED: { bg: "bg-emerald-300/10", text: "text-emerald-100", border: "border-emerald-300/30" },
  PROCESSING: { bg: "bg-cyan-300/10", text: "text-cyan-100", border: "border-cyan-300/30" },
  // Transient failures are visually distinct (amber, "retryable" wording)
  // from permanent ones (rose, "permanent" wording) - see issue #167's
  // "permanent and transient failures are visually and semantically
  // distinct."
  FAILED_TRANSIENT: { bg: "bg-amber-300/10", text: "text-amber-100", border: "border-amber-300/30" },
  FAILED_PERMANENT: { bg: "bg-rose-300/10", text: "text-rose-100", border: "border-rose-300/30" },
};

export function AnchoringStatusBadge({ status }: { status: AnchoringStatus }) {
  const style = statusStyles[status];
  return (
    <span
      className={`inline-flex h-7 w-fit items-center rounded-lg border px-2 text-xs font-semibold uppercase leading-4 ${style.bg} ${style.text} ${style.border}`}
    >
      {formatAnchoringStatus(status)}
    </span>
  );
}
