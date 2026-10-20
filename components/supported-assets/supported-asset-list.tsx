"use client";

import { useRef, useState } from "react";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { StatusBadge } from "@/components/common/production-ui";
import { setSupportedAssetStatus, type SupportedAssetRecord } from "@/lib/supported-assets/store";
import { isNativeAssetCode } from "@/lib/validation/supported-assets";
import { formatDate, formatMessage } from "@/lib/i18n";

export function SupportedAssetList({
  assets,
  loading,
  onAssetUpdated,
}: {
  assets: SupportedAssetRecord[];
  loading: boolean;
  onAssetUpdated: (record: SupportedAssetRecord) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{
    id: string;
    assetCode: string;
    nextStatus: "ACTIVE" | "INACTIVE";
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const handleToggleClick = (
    record: SupportedAssetRecord,
    trigger: HTMLButtonElement,
  ) => {
    triggerRef.current = trigger;
    setConfirmToggle({
      id: record.id,
      assetCode: record.assetCode,
      nextStatus: record.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
    });
  };

  const handleConfirmToggle = () => {
    if (!confirmToggle) return;
    try {
      const updated = setSupportedAssetStatus(confirmToggle.id, confirmToggle.nextStatus);
      onAssetUpdated(updated);
    } catch {
      setError("Failed to update asset status. Please try again.");
    } finally {
      setConfirmToggle(null);
      triggerRef.current?.focus();
    }
  };

  const handleCancelToggle = () => {
    setConfirmToggle(null);
    triggerRef.current?.focus();
  };

  if (loading && assets.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading supported assets...</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="rounded-md border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">
          No supported assets yet. Add your first one above.
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

        <div className="hidden grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] gap-4 border-b border-white/10 pb-2 text-xs font-semibold uppercase text-slate-400 md:grid">
          <div>Asset</div>
          <div>Issuer</div>
          <div>Network</div>
          <div>Status</div>
          <div>Updated</div>
          <div>Actions</div>
        </div>

        {assets.map((record) => (
          <div
            key={record.id}
            className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4 text-sm md:grid-cols-[1fr_2fr_1fr_1fr_1fr_auto] md:items-center md:gap-4"
          >
            <div className="font-medium text-white">{record.assetCode}</div>
            <div className="min-w-0 font-mono text-xs text-slate-400">
              {isNativeAssetCode(record.assetCode)
                ? "Native asset"
                : record.assetIssuer
                  ? `${record.assetIssuer.slice(0, 8)}...${record.assetIssuer.slice(-8)}`
                  : "—"}
            </div>
            <div className="text-slate-300">{record.network}</div>
            <div>
              <StatusBadge tone={record.status === "ACTIVE" ? "success" : "warning"}>
                {record.status}
              </StatusBadge>
              {record.deactivatedAt && record.status === "ACTIVE" && (
                <p className="mt-1 text-[11px] text-slate-500">
                  {formatMessage("Previously deactivated {date}", {
                    date: formatDate(record.deactivatedAt),
                  })}
                </p>
              )}
            </div>
            <div className="text-slate-400">{formatDate(record.updatedAt)}</div>
            <div className="flex gap-2">
              <button
                onClick={(e) => handleToggleClick(record, e.currentTarget)}
                className={`h-8 rounded border px-3 text-xs font-medium transition ${
                  record.status === "ACTIVE"
                    ? "border-amber-300/30 text-amber-200 hover:bg-amber-300/10"
                    : "border-emerald-300/30 text-emerald-200 hover:bg-emerald-300/10"
                }`}
                type="button"
              >
                {record.status === "ACTIVE" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmToggle && (
        <ConfirmationDialog
          title={
            confirmToggle.nextStatus === "INACTIVE"
              ? "Deactivate Supported Asset"
              : "Activate Supported Asset"
          }
          message={
            confirmToggle.nextStatus === "INACTIVE"
              ? formatMessage(
                  'Deactivating "{assetCode}" will prevent it from being used in new proofs and payments. Existing proofs and payments referencing it remain unaffected and identifiable.',
                  { assetCode: confirmToggle.assetCode },
                )
              : formatMessage(
                  'Activating "{assetCode}" will allow it to be used in new proofs and payments again.',
                  { assetCode: confirmToggle.assetCode },
                )
          }
          confirmText={confirmToggle.nextStatus === "INACTIVE" ? "Deactivate" : "Activate"}
          confirmVariant={confirmToggle.nextStatus === "INACTIVE" ? "danger" : "primary"}
          onConfirm={handleConfirmToggle}
          onCancel={handleCancelToggle}
        />
      )}
    </>
  );
}
