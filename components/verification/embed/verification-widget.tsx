"use client";

/**
 * The embeddable public proof-verification widget (issue #196).
 * =================================================================
 *
 * Rendered ONLY at `/embed/v{version}/verify/[id]` (see
 * `app/embed/v1/verify/[id]/page.tsx`), the one route family that carries
 * the narrowly-scoped `frame-ancestors *` CSP exception — see
 * `config/security-headers.ts` (`allowEmbedding`) and `proxy.ts` for that
 * carve-out, and `tests/security/headers.test.ts` /
 * `tests/security/proxy.test.ts` for the tests that keep it scoped to just
 * this route.
 *
 * Trust boundary: this component renders inside a third-party ("relying
 * party") page's iframe. The host page is UNTRUSTED input, not a
 * collaborator:
 * - The only data this widget accepts from its embedding context is the
 *   `id` route segment, which is validated with `isApprovedProofId`
 *   (`lib/validation/qr-payload.ts`) before it's used for anything. An id
 *   that doesn't match the allow-list renders `invalid-id`, never reaches
 *   `fetch`, and is never echoed back into the DOM.
 * - This widget never accepts a bearer token, session cookie, or private
 *   credential JSON from its host or query string — see
 *   `lib/api/verification-widget.ts` for the fetch contract.
 * - This widget does not read `postMessage` from its host at all. A
 *   hostile host page cannot make it render, fetch, or navigate anything
 *   by posting messages to it — there is no listener to receive them. (See
 *   `__tests__/verification-widget.test.tsx` for a regression test that
 *   dispatching a crafted `message` event changes nothing.)
 * - Every value rendered here is plain text (React's default JSX escaping,
 *   no `dangerouslySetInnerHTML` anywhere in this tree) — a malicious
 *   proof/credential field value from the API cannot execute script in the
 *   host page's origin (it's already isolated by the iframe boundary, but
 *   this is defense in depth against XSS within the widget's own frame).
 * - The widget never calls `window.top`/`window.parent` navigation APIs.
 *   It has no way to redirect or otherwise act on the host page.
 */

import { useEffect, useRef, useState } from "react";
import { SkeletonBlock, SkeletonContainer } from "@/components/common/skeleton/skeleton-base";
import { formatDateRange, formatDateTime, formatMessage } from "@/lib/i18n";
import { fetchWidgetVerification, type WidgetState } from "@/lib/api/verification-widget";
import type { VerifyProofResponse } from "@/lib/api/generated/v1";

const statusStyles: Record<VerifyProofResponse["status"], string> = {
  valid: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  expired: "border-amber-300/30 bg-amber-300/10 text-amber-100",
  revoked: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  unknown: "border-slate-300/20 bg-slate-300/10 text-slate-100",
  invalid: "border-rose-300/30 bg-rose-300/10 text-rose-100",
};

function statusMessage(result: VerifyProofResponse["result"]): string {
  switch (result) {
    case "VALID":
      return "This proof is currently valid.";
    case "EXPIRED":
      return "This proof has expired.";
    case "REVOKED":
      return "This proof has been revoked.";
    case "INVALID_SIGNATURE":
      return "This proof's cryptographic signature is invalid.";
    case "UNKNOWN_PROOF":
      return "No matching proof was found for this identifier.";
    case "UNVERIFIED_ISSUER":
      return "The issuer of this proof could not be verified.";
    default:
      return "The verification status could not be determined.";
  }
}

function WidgetShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[120px] w-full max-w-[420px] gap-3 rounded-lg border border-white/10 bg-slate-950 p-4 text-white sm:p-5">
      {children}
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <SkeletonContainer className="grid gap-3" label="Checking proof status...">
      <SkeletonBlock className="h-6 w-20 rounded-md" />
      <SkeletonBlock className="h-4 w-full" />
      <SkeletonBlock className="h-4 w-2/3" />
    </SkeletonContainer>
  );
}

function InvalidIdState() {
  return (
    <div role="alert">
      <p className="text-sm font-semibold text-rose-200">Invalid verification link</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        This embedded widget was not given a recognizable proof identifier.
      </p>
    </div>
  );
}

function UnavailableState({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert">
      <p className="text-sm font-semibold text-amber-200">Verification unavailable</p>
      <p className="mt-1 text-xs leading-5 text-slate-400">
        We couldn&apos;t reach EarnProof to check this proof right now.
      </p>
      <button
        className="mt-3 h-8 rounded-md border border-white/15 px-3 text-xs font-medium text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
        onClick={onRetry}
        type="button"
      >
        Try again
      </button>
    </div>
  );
}

function ResultState({ response }: { response: VerifyProofResponse }) {
  return (
    <div>
      <div
        className={`inline-flex rounded-md border px-3 py-1 text-xs font-semibold uppercase ${statusStyles[response.status]}`}
      >
        {response.status}
      </div>
      <p className="mt-3 text-sm leading-5 text-slate-300">{statusMessage(response.result)}</p>

      {response.credential && response.proof ? (
        <dl className="mt-4 grid gap-3 text-xs text-slate-300">
          <div>
            <dt className="font-semibold uppercase text-slate-500">Proof ID</dt>
            <dd className="mt-0.5 break-words text-slate-100">{response.proof.id}</dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-slate-500">Claim</dt>
            <dd className="mt-0.5 text-slate-100">
              {formatMessage("Income {operator} {amount} {asset}", {
                operator: response.credential.claim.operator,
                amount: response.credential.claim.thresholdAmount,
                asset: response.credential.claim.assetCode,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-slate-500">Period</dt>
            <dd className="mt-0.5 text-slate-100">
              {formatDateRange(
                response.credential.claim.periodStart,
                response.credential.claim.periodEnd,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold uppercase text-slate-500">Expires</dt>
            <dd className="mt-0.5 text-slate-100">{formatDateTime(response.proof.expiresAt)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-xs leading-5 text-slate-400">
          No further proof details are available for this identifier.
        </p>
      )}
    </div>
  );
}

/**
 * Renders the widget for a single (already route-resolved) proof
 * identifier. Fetches once on mount / whenever `proofId` changes, and
 * exposes a manual retry for the `unavailable` state without re-deriving
 * `proofId` from anywhere the host page could influence after mount.
 */
export function VerificationWidget({ proofId }: { proofId: string }) {
  const [state, setState] = useState<WidgetState>({ kind: "loading" });
  // Bumping this triggers the effect below to refetch — the same
  // generation-counter retry pattern `lib/capabilities/capability-context.tsx`
  // uses, so a slow in-flight request can't clobber a newer one.
  const [attempt, setAttempt] = useState(0);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    const controller = new AbortController();

    // Effects synchronize with external systems; the actual setState calls
    // happen inside this async closure, never synchronously within the
    // effect body itself — same pattern as
    // `lib/capabilities/capability-context.tsx`'s `load()`.
    async function load() {
      setState({ kind: "loading" });
      const next = await fetchWidgetVerification(proofId, { signal: controller.signal });
      if (requestIdRef.current !== requestId) return;
      setState(next);
    }

    load();

    return () => {
      controller.abort();
    };
  }, [proofId, attempt]);

  const retry = () => setAttempt((value) => value + 1);

  return (
    <WidgetShell>
      {state.kind === "loading" && <WidgetSkeleton />}
      {state.kind === "invalid-id" && <InvalidIdState />}
      {state.kind === "unavailable" && <UnavailableState onRetry={retry} />}
      {state.kind === "result" && <ResultState response={state.response} />}
    </WidgetShell>
  );
}
