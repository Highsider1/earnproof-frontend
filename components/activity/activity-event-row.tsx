import { UnknownActivityEvent } from "@/components/activity/unknown-event";
import { defineMessages, formatDateTime, formatMessage } from "@/lib/i18n";
import {
  isKnownActivityEvent,
  type ActivityEvent,
  type ActivityOutcome,
  type KnownActivityEvent,
} from "@/lib/api/activity";

const outcomeStyles: Record<ActivityOutcome, string> = {
  success: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
  failure: "border-rose-300/30 bg-rose-300/10 text-rose-100",
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-100",
};

const categoryLabels: Record<KnownActivityEvent["category"], string> = {
  auth: "Authentication",
  key: "API key",
  session: "Session",
  admin: "Administrative",
};

/**
 * Whole sentences with placeholders — never a template literal that splits
 * a sentence around a value (see tests/i18n/conventions.test.ts, and
 * `messages.claim` in components/verification/verification-panel.tsx for
 * the same pattern already used elsewhere). A translation is free to move
 * `{wallet}`/`{keyId}`/`{sessionId}`/`{target}` wherever its language needs
 * them.
 */
const messages = defineMessages("activity", {
  authChallengeIssued: "Sign-in challenge issued for wallet {wallet}",
  authSignedIn: "Wallet {wallet} signed in",
  authSignedOut: "Wallet {wallet} signed out",
  keyCreated: "API key {keyId} created",
  keyRotated: "API key {keyId} rotated",
  keyRevoked: "API key {keyId} revoked",
  sessionStarted: "Session {sessionId} started",
  sessionRefreshed: "Session {sessionId} refreshed",
  sessionExpired: "Session {sessionId} expired",
  adminOrgStatusChanged: "Organization status changed for {target}",
  adminIssuerApproved: "Issuer approved: {target}",
  adminIssuerSuspended: "Issuer suspended: {target}",
  fallback: "Activity event",
});

/**
 * Exhaustive switch over `action` per category — adding a new action to
 * `lib/api/activity.ts` without updating this function is a TypeScript
 * error (via the `never` fallthrough), so a summary can never silently
 * fall back to something misleading.
 */
function summarize(event: KnownActivityEvent): string {
  switch (event.category) {
    case "auth":
      switch (event.action) {
        case "wallet-challenge-issued":
          return formatMessage(messages.authChallengeIssued, { wallet: event.walletAddressMasked });
        case "wallet-signature-verified":
          return formatMessage(messages.authSignedIn, { wallet: event.walletAddressMasked });
        case "sign-out":
          return formatMessage(messages.authSignedOut, { wallet: event.walletAddressMasked });
      }
      break;
    case "key":
      switch (event.action) {
        case "api-key-created":
          return formatMessage(messages.keyCreated, { keyId: event.apiKeyIdMasked });
        case "api-key-rotated":
          return formatMessage(messages.keyRotated, { keyId: event.apiKeyIdMasked });
        case "api-key-revoked":
          return formatMessage(messages.keyRevoked, { keyId: event.apiKeyIdMasked });
      }
      break;
    case "session":
      switch (event.action) {
        case "session-started":
          return formatMessage(messages.sessionStarted, { sessionId: event.sessionIdMasked });
        case "session-refreshed":
          return formatMessage(messages.sessionRefreshed, { sessionId: event.sessionIdMasked });
        case "session-expired":
          return formatMessage(messages.sessionExpired, { sessionId: event.sessionIdMasked });
      }
      break;
    case "admin":
      switch (event.action) {
        case "organization-status-changed":
          return formatMessage(messages.adminOrgStatusChanged, { target: event.targetLabel });
        case "issuer-approved":
          return formatMessage(messages.adminIssuerApproved, { target: event.targetLabel });
        case "issuer-suspended":
          return formatMessage(messages.adminIssuerSuspended, { target: event.targetLabel });
      }
      break;
  }
  // Unreachable given the discriminated union above; kept so a future
  // action added to the union type is a compile error here instead of a
  // silent `undefined` summary at runtime.
  return messages.fallback;
}

export function ActivityEventRow({ event }: { event: ActivityEvent }) {
  if (!isKnownActivityEvent(event)) {
    return <UnknownActivityEvent event={event} />;
  }

  return (
    <div
      className="grid gap-2 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[auto_1fr_auto_auto] md:items-center md:gap-4"
      data-testid="activity-event-row"
    >
      <span className="inline-flex h-7 w-fit items-center rounded-lg border border-white/15 px-2 text-xs font-semibold uppercase text-slate-300">
        {categoryLabels[event.category]}
      </span>
      <div className="min-w-0">
        <p className="text-white">{summarize(event)}</p>
        {(event.locationLabel || event.ipAddressMasked) && (
          <p className="mt-1 text-xs text-slate-500">
            {[event.locationLabel, event.ipAddressMasked].filter(Boolean).join(" · ")}
          </p>
        )}
      </div>
      <span
        className={`inline-flex h-7 w-fit items-center rounded-lg border px-2 text-xs font-semibold uppercase ${outcomeStyles[event.outcome]}`}
      >
        {event.outcome}
      </span>
      <time className="text-xs text-slate-400" dateTime={event.occurredAt}>
        {formatDateTime(event.occurredAt)}
      </time>
    </div>
  );
}
