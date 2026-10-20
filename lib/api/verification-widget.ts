/**
 * Data layer for the embeddable public proof-verification widget
 * (issue #196).
 * =================================================================
 *
 * Unlike `lib/api/activity.ts` and `lib/api/capabilities.ts`, this module
 * talks to a REAL, already-shipped backend endpoint: `GET
 * /proofs/{proofId}/verify` (see `VerifyProofResponse` in
 * `lib/api/generated/v1.ts`, and `components/verification/verify-proof-form.tsx`
 * for the existing non-embed caller of the same endpoint). There is no new
 * backend contract here — this file only adds an embed-appropriate,
 * narrower way to call it.
 *
 * Security/privacy contract:
 * - The widget only ever accepts a PUBLIC proof/verification identifier as
 *   input (from the route's `[id]` segment). It never accepts, stores, or
 *   forwards a bearer token, session cookie, or private credential JSON —
 *   `fetchWidgetVerification` below calls `apiClient` with no
 *   `Authorization` header, exactly like the public (non-embed) verify
 *   flow already does.
 * - The identifier is validated with the SAME allow-list
 *   (`isApprovedProofId`) the rest of the app already uses for
 *   attacker-controlled proof-id-shaped input (QR payloads, the `?proof=`
 *   query param) before it is ever interpolated into a URL — see
 *   `lib/validation/qr-payload.ts`. An identifier that fails this check is
 *   treated as `invalid` without ever reaching `fetch`.
 */

import { apiClient } from "@/lib/api/client";
import { isApprovedProofId } from "@/lib/validation/qr-payload";
import type { VerifyProofResponse } from "@/lib/api/generated/v1";

/**
 * Widget entry point version. Bumped whenever the widget's rendered
 * contract (props/response shape a relying-party page can depend on)
 * changes in a way that isn't backward compatible. Surfaced in the route
 * (`/embed/v1/verify/[id]`) so an old embed snippet on a relying-party
 * site keeps working against the version it was generated for even after
 * a newer version ships.
 */
export const EMBED_WIDGET_VERSION = 1 as const;
export const SUPPORTED_EMBED_WIDGET_VERSIONS = [1] as const;
export type EmbedWidgetVersion = (typeof SUPPORTED_EMBED_WIDGET_VERSIONS)[number];

export function isSupportedEmbedWidgetVersion(value: string): value is `${EmbedWidgetVersion}` {
  return (SUPPORTED_EMBED_WIDGET_VERSIONS as readonly number[]).some(
    (version) => String(version) === value,
  );
}

/**
 * The widget's own state model — a strict superset-free mapping of
 * `VerifyProofResponse["status"]` plus states the API call itself can
 * produce (loading, and a distinct "unavailable" for anything that isn't a
 * clean success/known-status response: network failure, timeout, 5xx, or
 * an invalid input identifier). Kept separate from `VerifyProofResponse`
 * so the widget can render "unavailable" for cases the API layer collapses
 * into a thrown error, without the rendering code needing to inspect error
 * internals.
 */
export type WidgetState =
  | { kind: "loading" }
  | { kind: "invalid-id" }
  | { kind: "unavailable" }
  | { kind: "result"; response: VerifyProofResponse };

/**
 * Fetches verification for a widget-supplied identifier. Never throws for
 * an expected failure mode (invalid id shape, network error, non-2xx) —
 * callers get a `WidgetState` back and decide how to render it. This
 * mirrors the "fail closed / render an explicit state" pattern
 * `lib/api/capabilities.ts` and `lib/api/activity.ts` already use
 * elsewhere in this codebase, applied here to a real network call instead
 * of a mock.
 */
export async function fetchWidgetVerification(
  rawId: string,
  options: { signal?: AbortSignal } = {},
): Promise<WidgetState> {
  const trimmed = rawId.trim();

  if (!isApprovedProofId(trimmed)) {
    return { kind: "invalid-id" };
  }

  try {
    const response = await apiClient<VerifyProofResponse>({
      path: `/proofs/${encodeURIComponent(trimmed)}/verify`,
      method: "GET",
      signal: options.signal,
    });
    return { kind: "result", response };
  } catch {
    return { kind: "unavailable" };
  }
}
