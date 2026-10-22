"use client";

import { CapabilityProvider, useCapability } from "@/lib/capabilities/capability-context";
import { VerificationWidget } from "@/components/verification/embed/verification-widget";

/**
 * Wires the embeddable verification widget up to the capability system
 * from issue #194 (`embeddable-verification-widget` — see
 * `lib/api/capabilities.ts`). As with `ActivityLogGate`, this is a UX-only
 * gate: the server-side scoping/redaction the real `/proofs/{id}/verify`
 * endpoint already enforces is what actually protects this data. All this
 * gate decides is whether to render the widget UI at all versus an
 * explicit "not available" state — never whether the underlying
 * verification request is allowed to succeed.
 *
 * Deliberately does NOT reuse `CapabilityUnavailable`
 * (`components/common/capability-unavailable.tsx`): that component links
 * back to the main EarnProof app ("Back to EarnProof"), which is
 * meaningless — and would be a confusing/broken link target — inside a
 * small iframe embedded on an unrelated relying-party site.
 */
function GatedVerificationWidget({ proofId }: { proofId: string }) {
  const { enabled, status } = useCapability("embeddable-verification-widget");

  if (status === "loading") {
    return (
      <div
        className="grid min-h-[120px] w-full max-w-[420px] place-items-center rounded-lg border border-white/10 bg-slate-950 p-4 text-white"
        role="status"
      >
        <span className="text-xs text-slate-400">Loading...</span>
      </div>
    );
  }

  if (!enabled) {
    return (
      <div
        className="grid min-h-[120px] w-full max-w-[420px] gap-1 rounded-lg border border-white/10 bg-slate-950 p-4 text-white"
        role="status"
      >
        <p className="text-sm font-semibold text-slate-200">Verification widget unavailable</p>
        <p className="text-xs leading-5 text-slate-400">
          This embeddable widget isn&apos;t enabled for this deployment yet.
        </p>
      </div>
    );
  }

  return <VerificationWidget proofId={proofId} />;
}

export function VerificationWidgetGate({ proofId }: { proofId: string }) {
  return (
    <CapabilityProvider>
      <GatedVerificationWidget proofId={proofId} />
    </CapabilityProvider>
  );
}
