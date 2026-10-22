import { formatChainVerificationStatus, type ChainVerificationResult } from "@/lib/api/audit";
import { formatDateTime } from "@/lib/i18n";

const statusStyles: Record<ChainVerificationResult["status"], { bg: string; text: string; border: string }> = {
  INTACT: { bg: "bg-emerald-300/10", text: "text-emerald-100", border: "border-emerald-300/30" },
  // A broken chain is never allowed to read as a routine warning - it's an
  // integrity failure, so it gets the same rose treatment as a revoked
  // proof, not the amber "something's off but survivable" treatment. See
  // issue #161's "integrity failures are prominent and never normalized
  // into success."
  BROKEN: { bg: "bg-rose-300/10", text: "text-rose-100", border: "border-rose-300/30" },
  UNKNOWN: { bg: "bg-slate-300/10", text: "text-slate-100", border: "border-slate-300/20" },
};

export function ChainVerificationStatus({ result }: { result: ChainVerificationResult }) {
  const style = statusStyles[result.status];

  return (
    <div className={`rounded-lg border p-4 ${style.bg} ${style.border}`} role={result.status === "BROKEN" ? "alert" : undefined}>
      <h3 className={`text-sm font-semibold ${style.text}`}>{formatChainVerificationStatus(result.status)}</h3>
      {result.status === "INTACT" && result.verifiedThrough && (
        <p className="mt-1 text-xs text-emerald-200">Verified through {formatDateTime(result.verifiedThrough)}.</p>
      )}
      {result.status === "BROKEN" && result.firstBreak && (
        <p className="mt-1 text-xs text-rose-200">
          First reported break at sequence #{result.firstBreak.sequenceNumber}, detected{" "}
          {formatDateTime(result.firstBreak.detectedAt)}.
        </p>
      )}
      {result.status === "UNKNOWN" && (
        <p className="mt-1 text-xs text-slate-300">Chain verification could not be completed. Try refreshing.</p>
      )}
    </div>
  );
}
