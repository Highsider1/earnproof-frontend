"use client";

import { useRef, useState } from "react";
import type { Webhook } from "@/lib/api/webhooks";

export function WebhookActionMenu({
  webhook,
  isActioning,
  onToggleStatus,
  onRotate,
  onDelete,
}: {
  webhook: Webhook;
  isActioning: boolean;
  onToggleStatus: (webhook: Webhook) => void;
  onRotate: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  if (isOpen) {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-white/15 text-white hover:bg-white/[0.08] transition disabled:opacity-50"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isActioning}
        type="button"
        aria-label="Webhook actions menu"
      >
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-10 z-10 w-48 rounded-lg border border-white/10 bg-slate-900 shadow-lg">
          <div className="py-1">
            <button
              className="w-full px-4 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] transition disabled:opacity-50 flex items-center justify-between"
              onClick={() => {
                onToggleStatus(webhook);
                setIsOpen(false);
              }}
              disabled={isActioning}
              type="button"
            >
              {webhook.status === "ACTIVE" ? "Disable" : "Enable"}
            </button>

            <button
              className="w-full px-4 py-2 text-left text-xs text-slate-200 hover:bg-white/[0.08] transition disabled:opacity-50"
              onClick={() => {
                onRotate();
                setIsOpen(false);
              }}
              disabled={isActioning}
              type="button"
            >
              Rotate Secret
            </button>

            <div className="border-t border-white/10" />

            <button
              className="w-full px-4 py-2 text-left text-xs text-rose-200 hover:bg-rose-300/10 transition disabled:opacity-50"
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              disabled={isActioning}
              type="button"
            >
              Delete Endpoint
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
