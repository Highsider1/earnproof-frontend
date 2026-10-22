"use client";

import { useSyncExternalStore } from "react";
import { formatDateTimeWithZone, formatRelativeTime } from "@/lib/i18n";

/**
 * `useSyncExternalStore`'s snapshot differs between server and client
 * (`getServerSnapshot` returns `false`; the client snapshot is `true`) by
 * design — React's own documented pattern for "render something only once
 * mounted on the client," used here instead of a `useState` + `useEffect`
 * mount flag so it never triggers `react-hooks/set-state-in-effect`. There
 * is no real external store to subscribe to, so `subscribe` never actually
 * calls back; React itself invokes the client render a second time after
 * the server-matching first commit.
 */
function subscribeNoop(): () => void {
  return () => {};
}
function getClientSnapshot(): boolean {
  return true;
}
function getServerSnapshot(): boolean {
  return false;
}
function useMounted(): boolean {
  return useSyncExternalStore(subscribeNoop, getClientSnapshot, getServerSnapshot);
}

/**
 * One shared way to render a timestamp (#151): the exact value always
 * discloses its timezone, the original instant is preserved in a
 * machine-readable `<time dateTime>` attribute, and an optional relative
 * label ("2 hours ago") is layered on top without ever causing a
 * server/client hydration mismatch.
 *
 * Used for proof issued/expiry dates, payment dates, issuer timestamps, and
 * API key created/expires/rotated dates — anywhere `formatDateTime` was
 * previously called directly in JSX.
 */
export function Timestamp({
  value,
  showRelative = false,
  className,
}: {
  /** An ISO string, epoch millis, or `Date`. Invalid/missing values render
   * as an explicit placeholder rather than a misleading or blank date. */
  value: Date | string | number | null | undefined;
  /** Adds a relative label ("2 hours ago") after the exact value. Off by
   * default: not every call site (e.g. a fixed proof expiry date) wants
   * one, and it costs a client-only render pass. */
  showRelative?: boolean;
  className?: string;
}) {
  // The server render and the first client render both see `mounted ===
  // false` and produce identical markup — computing "time since X" during
  // SSR would embed the server's clock time into the markup, which is very
  // likely to differ from the client's clock time by the time hydration
  // runs. Only the second client render (which React runs automatically
  // once the client snapshot differs from the server one) shows the
  // relative label, so it can never appear in a hydration diff: React
  // reconciles hydration against the first commit, not this one.
  const mounted = useMounted();

  const date = value === null || value === undefined ? null : new Date(value);
  const isValid = date !== null && !Number.isNaN(date.getTime());

  if (!isValid) {
    return (
      <span className={className} title="No date available">
        Unknown date
      </span>
    );
  }

  const exact = formatDateTimeWithZone(date);
  const relativeLabel = showRelative && mounted ? formatRelativeTime(date) : null;

  return (
    <time className={className} dateTime={date.toISOString()} title={exact}>
      {exact}
      {relativeLabel ? <span className="text-slate-400"> ({relativeLabel})</span> : null}
    </time>
  );
}
