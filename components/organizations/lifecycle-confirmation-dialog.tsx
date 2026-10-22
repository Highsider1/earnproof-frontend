"use client";

import { useEffect, useRef } from "react";
import type { LifecycleAction } from "@/lib/api/organizations";

/**
 * Impact descriptions for each lifecycle action
 */
const lifecycleImpacts: Record<LifecycleAction, { title: string; description: string; impacts: string[] }> = {
  activate: {
    title: "Activate Organization",
    description: "Reactivate this organization to enable member access and integrations.",
    impacts: [
      "Members will regain access to organization resources",
      "Integrations and API access will be re-enabled",
      "Billing will resume (if applicable)",
    ],
  },
  suspend: {
    title: "Suspend Organization",
    description: "Temporarily disable organization operations while preserving all data.",
    impacts: [
      "Members will lose access to organization resources",
      "API access and integrations will be disabled",
      "Data will be preserved and available after reactivation",
      "Billing may be paused (depending on plan terms)",
    ],
  },
  archive: {
    title: "Archive Organization",
    description: "Archive this organization for record-keeping while restricting all access.",
    impacts: [
      "All members will lose access permanently",
      "The organization will be read-only for administrators",
      "Integrations and webhooks will be disabled",
      "API access will be restricted",
      "Data will be retained indefinitely for compliance",
    ],
  },
  revoke: {
    title: "Revoke Organization",
    description: "Permanently disable this organization. This action cannot be undone.",
    impacts: [
      "All members will immediately lose access",
      "All integrations and API keys will be invalidated",
      "No new operations can be performed on this organization",
      "Data will be retained for audit and compliance",
      "This action is permanent and cannot be reversed",
    ],
  },
};

export function LifecycleConfirmationDialog({
  action,
  organizationName,
  onConfirm,
  onCancel,
  isProcessing = false,
}: {
  action: LifecycleAction;
  organizationName: string;
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const impact = lifecycleImpacts[action];
  const isDangerous = action === "revoke" || action === "archive";

  // Focus the cancel button when dialog opens
  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) {
        onCancel();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onCancel, isProcessing]);

  const confirmButtonClass = isDangerous
    ? "bg-rose-600 hover:bg-rose-700 text-white"
    : "bg-cyan-300 hover:bg-cyan-200 text-slate-950";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lifecycle-dialog-title"
        aria-describedby="lifecycle-dialog-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h2 id="lifecycle-dialog-title" className="text-lg font-semibold text-white">
          {impact.title}
        </h2>

        <p id="lifecycle-dialog-description" className="mt-3 text-sm text-slate-300">
          <strong>{organizationName}</strong>
        </p>

        <p className="mt-2 text-sm leading-6 text-slate-300">
          {impact.description}
        </p>

        {/* Downstream impacts */}
        <div className={`mt-4 rounded-md p-3 ${
          isDangerous
            ? "border border-rose-300/30 bg-rose-300/10"
            : "border border-amber-300/30 bg-amber-300/10"
        }`}>
          <p className={`text-xs font-semibold ${
            isDangerous ? "text-rose-200" : "text-amber-200"
          }`}>
            {isDangerous ? "Important:" : "This will:"} Downstream effects
          </p>
          <ul className={`mt-2 space-y-1 text-xs ${
            isDangerous ? "text-rose-200/80" : "text-amber-200/80"
          }`}>
            {impact.impacts.map((imp, idx) => (
              <li key={idx} className="flex gap-2">
                <span className="mt-0.5 flex-shrink-0">•</span>
                <span>{imp}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            ref={cancelButtonRef}
            onClick={onCancel}
            disabled={isProcessing}
            className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isProcessing}
            className={`h-10 rounded-md px-4 text-sm font-medium disabled:opacity-50 transition ${confirmButtonClass}`}
            type="button"
          >
            {isProcessing ? "Processing..." : `${impact.title.split(" ")[0]} Organization`}
          </button>
        </div>
      </div>
    </div>
  );
}
