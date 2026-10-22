/**
 * Safe fallback renderer for an activity event whose `category` this
 * frontend build doesn't recognize (e.g. served by a newer backend
 * version, or a future event type rolled out ahead of this deploy).
 *
 * Deliberately renders NONE of the event's raw fields — only its id and
 * timestamp, if present and string-shaped. Any other field could be an
 * unredacted identifier the redaction contract in `lib/api/activity.ts`
 * never got a chance to mask, so printing it here would be a privacy
 * leak, not just a cosmetic gap.
 */

import { formatDateTime } from "@/lib/i18n";
import type { ActivityEvent } from "@/lib/api/activity";

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function UnknownActivityEvent({ event }: { event: ActivityEvent }) {
  const occurredAt = safeString((event as { occurredAt?: unknown }).occurredAt);

  return (
    <div
      className="grid gap-1 rounded-md border border-white/10 bg-slate-950 p-4 text-sm"
      data-testid="unknown-activity-event"
    >
      <div className="font-medium text-slate-300">Unrecognized activity event</div>
      <p className="text-xs text-slate-500">
        This event type isn&apos;t supported by this version of EarnProof yet. Details are
        hidden until support is added.
      </p>
      {occurredAt && (
        <div className="text-xs text-slate-500">{formatDateTime(occurredAt)}</div>
      )}
    </div>
  );
}
