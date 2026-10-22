"use client";

import { useEffect, useRef } from "react";

interface UnsavedChangesDialogProps {
  onStay: () => void;
  onDiscard: () => void;
  onSaveDraft?: () => void;
  isProcessing?: boolean;
}

/**
 * Stay / discard / save-draft prompt shown by useUnsavedChangesGuard when a
 * navigation is attempted while a form is dirty. Styled after
 * components/common/confirmation-dialog.tsx's overlay/focus/Escape pattern,
 * extended with a third action since that component only supports two.
 */
export function UnsavedChangesDialog({
  onStay,
  onDiscard,
  onSaveDraft,
  isProcessing = false,
}: UnsavedChangesDialogProps) {
  const stayButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    stayButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isProcessing) {
        onStay();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onStay, isProcessing]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-changes-title"
        aria-describedby="unsaved-changes-description"
        className="w-full max-w-md rounded-lg border border-white/10 bg-slate-900 p-6 shadow-xl"
      >
        <h2 id="unsaved-changes-title" className="text-lg font-semibold text-white">
          Unsaved changes
        </h2>
        <p id="unsaved-changes-description" className="mt-2 text-sm leading-6 text-slate-300">
          You have unsaved changes. Leaving now will discard them unless you save a draft.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            onClick={onDiscard}
            disabled={isProcessing}
            className="h-10 rounded-md border border-rose-300/30 px-4 text-sm font-medium text-rose-200 hover:bg-rose-300/10 disabled:opacity-50 transition"
            type="button"
          >
            Discard
          </button>
          {onSaveDraft && (
            <button
              onClick={onSaveDraft}
              disabled={isProcessing}
              className="h-10 rounded-md border border-white/15 px-4 text-sm font-medium text-white hover:bg-white/5 disabled:opacity-50 transition"
              type="button"
            >
              Save draft
            </button>
          )}
          <button
            ref={stayButtonRef}
            onClick={onStay}
            disabled={isProcessing}
            className="h-10 rounded-md bg-cyan-300 px-4 text-sm font-medium text-slate-950 hover:bg-cyan-200 disabled:opacity-50 transition"
            type="button"
          >
            Stay
          </button>
        </div>
      </div>
    </div>
  );
}
