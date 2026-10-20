import { defineMessages, formatDateRange, formatDateTimeWithZone, formatMessage } from "@/lib/i18n";
import { usePrintMode } from "@/lib/use-print-mode";

/**
 * Only the fields this component actually reads. Kept narrower than either
 * call site's full `VerifyProofResponse` (the hand-written one in
 * `verification-panel.tsx` and the generated one in
 * `lib/api/generated/v1.ts`) so both are structurally assignable here
 * without the two having to be kept byte-for-byte identical.
 */
export type PrintableProofResult = {
  status: string;
  credential?: {
    claim: {
      operator: string;
      thresholdAmount: string;
      assetCode: string;
      periodStart: string;
      periodEnd: string;
    };
    issuedAt: string;
    expiresAt: string;
    subject: { walletHash: string };
  };
  proof?: {
    id: string;
    network: string;
    revokedAt?: string | null;
  };
};

const messages = defineMessages("printableProofSummary", {
  // Mirrors VerificationPanel's "claim" message: one whole sentence with
  // placeholders so a translation can reorder operator/amount/asset freely.
  claim: "Income {operator} {amount} {asset}",
});

/**
 * Truncates a long identifier the same way the on-screen wallet-hash display
 * does: enough of the prefix to be recognizable, never the full value. Print
 * output must not leak more than the screen already redacts (#148).
 */
function truncateForDisplay(value: string): string {
  return value.length > 10 ? `${value.substring(0, 10)}...` : value;
}

/**
 * Print-only presentation of a proof verification result (#148).
 *
 * Gated on `usePrintMode()` so this subtree doesn't exist in the DOM at
 * all outside of an actual print: the interactive `VerificationPanel` /
 * `VerificationResult` this sits alongside stays mounted and print-hidden
 * via CSS, but duplicating both into the DOM unconditionally would expose
 * the same status/dates/IDs twice to assistive tech and to
 * `getByText`/`getByRole` queries. The `hidden print:block` CSS classes
 * are kept as a belt-and-suspenders fallback for browsers where the
 * `print` media query listener doesn't fire before the print snapshot is
 * taken.
 *
 * Only the canonical proof identifier, network, claim summary, and
 * verification/issuance dates are printed. Wallet hash and credential hash
 * are truncated exactly as they are on screen; this component never
 * receives or prints unrelated account data (settings, API keys, session
 * info) because it only takes a `VerifyProofResponse`.
 */
export function PrintableProofSummary({ result }: { result: PrintableProofResult }) {
  const isPrinting = usePrintMode();
  if (!isPrinting) {
    return null;
  }

  return (
    <div className="hidden print:block print:text-black">
      <h2 className="text-lg font-semibold">EarnProof verification result</h2>
      <p className="mt-1 text-sm uppercase tracking-wide">{result.status}</p>

      {result.credential && result.proof ? (
        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm [overflow-wrap:anywhere]">
          <div>
            <dt className="font-semibold">Proof ID</dt>
            <dd>{result.proof.id}</dd>
          </div>
          <div>
            <dt className="font-semibold">Network</dt>
            <dd>{result.proof.network}</dd>
          </div>
          <div>
            <dt className="font-semibold">Claim</dt>
            <dd>
              {formatMessage(messages.claim, {
                operator: result.credential.claim.operator,
                amount: result.credential.claim.thresholdAmount,
                asset: result.credential.claim.assetCode,
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Verification period</dt>
            <dd>
              {formatDateRange(
                result.credential.claim.periodStart,
                result.credential.claim.periodEnd,
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold">Issued</dt>
            <dd>{formatDateTimeWithZone(result.credential.issuedAt)}</dd>
          </div>
          <div>
            <dt className="font-semibold">Expires</dt>
            <dd>{formatDateTimeWithZone(result.credential.expiresAt)}</dd>
          </div>
          {result.proof.revokedAt ? (
            <div>
              <dt className="font-semibold">Revoked</dt>
              <dd>{formatDateTimeWithZone(result.proof.revokedAt)}</dd>
            </div>
          ) : null}
          <div>
            <dt className="font-semibold">Wallet hash</dt>
            <dd>{truncateForDisplay(result.credential.subject.walletHash)}</dd>
          </div>
        </dl>
      ) : (
        <p className="mt-4 text-sm">
          No matching EarnProof credential was found for this identifier.
        </p>
      )}

      <p className="mt-6 text-xs">
        Printed from EarnProof. Verify this result again at any time using the Proof ID above.
      </p>
    </div>
  );
}
