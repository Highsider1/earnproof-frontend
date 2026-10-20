/**
 * Degraded network indicator component.
 *
 * Displays when the network is slow, flaky, or unreliable.
 * Provides honest feedback about degraded conditions without hiding UI.
 *
 * Accessibility:
 * - Uses aria-live="polite" (non-intrusive)
 * - Does not trap focus
 * - Keyboard accessible
 */

"use client";

import { useNetworkStatus } from "@/lib/network";

export interface DegradedNetworkIndicatorProps {
  /**
   * Show a verbose message with advice.
   * If false, shows just the indicator icon and minimal text.
   */
  verbose?: boolean;

  /**
   * Custom class for styling the container.
   */
  className?: string;
}

export function DegradedNetworkIndicator({
  verbose = false,
  className = "",
}: DegradedNetworkIndicatorProps) {
  const { isOnline, isDegraded } = useNetworkStatus();

  // Don't show indicator if online and not degraded
  if (isOnline && !isDegraded) {
    return null;
  }

  if (!isOnline) {
    return (
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className={`flex items-center gap-2 rounded-lg border border-rose-300/50 bg-rose-300/10 px-3 py-2 text-sm ${className}`}
      >
        <span className="text-rose-200" aria-hidden="true">
          ⚠️
        </span>
        <span className="text-slate-300">
          {verbose ? "You're offline. Some features may not work." : "Offline"}
        </span>
      </div>
    );
  }

  if (isDegraded) {
    return (
      <div
        aria-live="polite"
        aria-atomic="true"
        role="status"
        className={`flex items-center gap-2 rounded-lg border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-sm ${className}`}
      >
        <span className="text-amber-200" aria-hidden="true">
          ⚡
        </span>
        <span className="text-slate-300">
          {verbose
            ? "Your network is slow or unstable. Requests may take longer."
            : "Degraded network"}
        </span>
      </div>
    );
  }

  return null;
}

/**
 * Inline network status indicator for headers/toolbars.
 * Shows just the icon and minimal text.
 */
export function NetworkStatusBadge() {
  const { isOnline, isDegraded } = useNetworkStatus();

  if (!isOnline) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold text-rose-200"
        title="You are offline"
      >
        <span aria-hidden="true">●</span>
        <span className="sr-only">Offline</span>
      </span>
    );
  }

  if (isDegraded) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-200"
        title="Network is degraded"
      >
        <span aria-hidden="true">◐</span>
        <span className="sr-only">Degraded network</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-200"
      title="Connected"
    >
      <span aria-hidden="true">●</span>
      <span className="sr-only">Connected</span>
    </span>
  );
}
