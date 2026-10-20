"use client";

import { useCallback, useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import {
  deleteTrustedSource,
  updateTrustedSource,
  type TrustedSourceRecord,
} from "@/lib/trusted-sources/store";
import { formatDate, formatMessage } from "@/lib/i18n";
import type { Issuer } from "@/lib/api/generated/v1";

export function TrustedSourceList({
  userId,
  trustedSources,
  issuers,
  loading,
  onTrustedSourceUpdated,
  onTrustedSourceDeleted,
}: {
  userId: string;
  trustedSources: TrustedSourceRecord[];
  issuers: Issuer[];
  loading: boolean;
  onTrustedSourceUpdated: (record: TrustedSourceRecord) => void;
  onTrustedSourceDeleted: (id: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editIssuerId, setEditIssuerId] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Remembers which row's delete button triggered the confirmation dialog,
  // so focus can return to that exact button once the dialog closes —
  // rather than falling back to document body (#135's "restore focus
  // predictably" acceptance criterion).
  const deleteTriggerRef = useRef<HTMLButtonElement | null>(null);

  const issuerName = useCallback(
    (issuerId: string) => issuers.find((i) => i.id === issuerId)?.name ?? "Unknown issuer",
    [issuers],
  );

  const startEdit = (record: TrustedSourceRecord) => {
    setEditingId(record.id);
    setEditName(record.name);
    setEditIssuerId(record.issuerId);
    setError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = (id: string) => {
    setError(null);
    try {
      if (!editIssuerId) {
        setError("An issuer must be selected.");
        return;
      }
      const updated = updateTrustedSource(userId, id, {
        name: editName,
        issuerId: editIssuerId,
      });
      onTrustedSourceUpdated(updated);
      setEditingId(null);
    } catch {
      setError("Failed to update trusted source. Please try again.");
    }
  };

  const handleDeleteClick = (
    record: TrustedSourceRecord,
    trigger: HTMLButtonElement,
  ) => {
    deleteTriggerRef.current = trigger;
    setConfirmDelete({ id: record.id, name: record.name });
  };

  const handleConfirmDelete = () => {
    if (!confirmDelete) return;
    try {
      deleteTrustedSource(userId, confirmDelete.id);
      onTrustedSourceDeleted(confirmDelete.id);
    } catch {
      setError("Failed to delete trusted source. Please try again.");
    } finally {
      setConfirmDelete(null);
      deleteTriggerRef.current?.focus();
    }
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
    deleteTriggerRef.current?.focus();
  };

  if (loading && trustedSources.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading trusted sources...</p>
      </div>
    );
  }

  if (trustedSources.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">
          No trusted sources yet. Add your first one above.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3">
        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="hidden grid-cols-[2fr_1.5fr_1fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
          <div>Name</div>
          <div>Linked issuer</div>
          <div>Updated</div>
          <div>Actions</div>
        </div>

        {trustedSources.map((record) =>
          editingId === record.id ? (
            <div
              key={record.id}
              className="grid gap-3 rounded-md border border-cyan-300/30 bg-slate-950 p-4 text-sm md:grid-cols-[2fr_1.5fr_1fr_auto] md:items-center md:gap-4"
            >
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                aria-label="Trusted source name"
                className="h-9 rounded-md border border-white/15 bg-slate-900 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
              />
              <select
                value={editIssuerId}
                onChange={(e) => setEditIssuerId(e.target.value)}
                aria-label="Linked issuer"
                className="h-9 rounded-md border border-white/15 bg-slate-900 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
              >
                {issuers.map((issuer) => (
                  <option key={issuer.id} value={issuer.id}>
                    {issuer.name}
                  </option>
                ))}
              </select>
              <div className="text-slate-400">
                {formatDate(record.updatedAt)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(record.id)}
                  className="h-8 rounded border border-emerald-300/30 px-3 text-xs font-medium text-emerald-200 hover:bg-emerald-300/10 transition"
                  type="button"
                >
                  Save
                </button>
                <button
                  onClick={cancelEdit}
                  className="h-8 rounded border border-white/15 px-3 text-xs font-medium text-white hover:bg-white/5 transition"
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              key={record.id}
              className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[2fr_1.5fr_1fr_auto] md:items-center md:gap-4"
            >
              <div className="min-w-0 font-medium text-white">{record.name}</div>
              <div className="min-w-0 text-slate-300">{issuerName(record.issuerId)}</div>
              <div className="text-slate-400">
                {formatDate(record.updatedAt)}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => startEdit(record)}
                  className="h-8 rounded border border-cyan-300/30 px-3 text-xs font-medium text-cyan-200 hover:bg-cyan-300/10 transition"
                  type="button"
                >
                  Edit
                </button>
                <button
                  onClick={(e) => handleDeleteClick(record, e.currentTarget)}
                  className="h-8 rounded border border-rose-300/30 px-3 text-xs font-medium text-rose-200 hover:bg-rose-300/10 transition"
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {confirmDelete && (
        <ConfirmationDialog
          title="Delete Trusted Source"
          message={formatMessage(
            'Are you sure you want to delete "{name}"? This action cannot be undone.',
            { name: confirmDelete.name },
          )}
          confirmText="Delete"
          confirmVariant="danger"
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </>
  );
}
