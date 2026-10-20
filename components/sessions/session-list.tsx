"use client";

import { useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { StatusBadge } from "@/components/common/production-ui";
import { revokeSession, revokeAllOtherSessions, type SessionRecord } from "@/lib/sessions/store";
import { formatDateTime, formatMessage } from "@/lib/i18n";

export function SessionList({
  userId,
  sessions,
  loading,
  onSessionsChanged,
}: {
  userId: string;
  sessions: SessionRecord[];
  loading: boolean;
  onSessionsChanged: (sessions: SessionRecord[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState<{
    id: string;
    deviceLabel: string;
  } | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const revokeAllTriggerRef = useRef<HTMLButtonElement | null>(null);

  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevokeClick = (session: SessionRecord, trigger: HTMLButtonElement) => {
    triggerRef.current = trigger;
    setConfirmRevoke({ id: session.id, deviceLabel: session.deviceLabel });
  };

  const handleConfirmRevoke = () => {
    if (!confirmRevoke) return;
    setError(null);
    try {
      revokeSession(userId, confirmRevoke.id);
      onSessionsChanged(sessions.filter((s) => s.id !== confirmRevoke.id));
    } catch {
      setError("Failed to revoke session. It may have already been revoked.");
    } finally {
      setConfirmRevoke(null);
      triggerRef.current?.focus();
    }
  };

  const handleCancelRevoke = () => {
    setConfirmRevoke(null);
    triggerRef.current?.focus();
  };

  const handleRevokeAllClick = (trigger: HTMLButtonElement) => {
    revokeAllTriggerRef.current = trigger;
    setConfirmRevokeAll(true);
  };

  const handleConfirmRevokeAll = () => {
    setError(null);
    try {
      revokeAllOtherSessions(userId);
      onSessionsChanged(sessions.filter((s) => s.isCurrent));
    } catch {
      setError("Failed to revoke sessions. Please try again.");
    } finally {
      setConfirmRevokeAll(false);
      revokeAllTriggerRef.current?.focus();
    }
  };

  const handleCancelRevokeAll = () => {
    setConfirmRevokeAll(false);
    revokeAllTriggerRef.current?.focus();
  };

  if (loading && sessions.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading sessions...</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      {error && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {error}
          </p>
        </div>
      )}

      {otherSessions.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={(e) => handleRevokeAllClick(e.currentTarget)}
            className="h-9 rounded-md border border-rose-300/30 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-300/10"
            type="button"
          >
            Sign out all other sessions
          </button>
        </div>
      )}

      <div className="hidden grid-cols-[2fr_1.5fr_1.5fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
        <div>Device</div>
        <div>First seen</div>
        <div>Last used</div>
        <div>Actions</div>
      </div>

      {sessions.map((session) => (
        <div
          key={session.id}
          className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[2fr_1.5fr_1.5fr_auto] md:items-center md:gap-4"
        >
          <div className="flex items-center gap-2 font-medium text-white">
            {session.deviceLabel}
            {session.isCurrent && (
              <StatusBadge tone="success">This device</StatusBadge>
            )}
          </div>
          <div className="text-slate-400">{formatDateTime(session.createdAt)}</div>
          <div className="text-slate-400">{formatDateTime(session.lastUsedAt)}</div>
          <div>
            {!session.isCurrent && (
              <button
                onClick={(e) => handleRevokeClick(session, e.currentTarget)}
                className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 transition"
                type="button"
              >
                Sign out
              </button>
            )}
          </div>
        </div>
      ))}

      {confirmRevoke && (
        <ConfirmationDialog
          title="Sign Out Device"
          message={formatMessage(
            'Are you sure you want to sign out "{deviceLabel}"? That device will need to reconnect its wallet to use this session again.',
            { deviceLabel: confirmRevoke.deviceLabel },
          )}
          confirmText="Sign out"
          confirmVariant="danger"
          onConfirm={handleConfirmRevoke}
          onCancel={handleCancelRevoke}
        />
      )}

      {confirmRevokeAll && (
        <ConfirmationDialog
          title="Sign Out All Other Sessions"
          message={formatMessage(
            "Are you sure you want to sign out all {count} other active sessions? This device's session will remain signed in.",
            { count: otherSessions.length },
          )}
          confirmText="Sign out all"
          confirmVariant="danger"
          onConfirm={handleConfirmRevokeAll}
          onCancel={handleCancelRevokeAll}
        />
      )}
    </div>
  );
}
