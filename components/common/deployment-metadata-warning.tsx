"use client";

import type { DeploymentMetadataState } from "@/lib/deployment/deployment-metadata";

export interface DeploymentMetadataWarningProps {
  state: DeploymentMetadataState;
}

/**
 * The explicit degraded state #185 requires for every non-"valid" outcome:
 * shown instead of proceeding to a wallet signature request, so the failure
 * is visible rather than silently blocking with no explanation.
 */
export function DeploymentMetadataWarning({ state }: DeploymentMetadataWarningProps) {
  if (state.status === "valid") {
    return null;
  }

  const message = (() => {
    switch (state.status) {
      case "unavailable":
        return `This app couldn't verify its deployment configuration (${state.reason}). Wallet actions are disabled until this is resolved.`;
      case "malformed":
        return `This app's deployment configuration failed signature verification (${state.reason}). Wallet actions are disabled for your security.`;
      case "stale":
        return "This app's deployment configuration is out of date. Wallet actions are disabled until it refreshes.";
      case "mismatched":
        return `This app is configured for a different network or contract set than expected (${state.mismatches.map((m) => m.field).join(", ")}). Wallet actions are disabled for your security.`;
    }
  })();

  return (
    <div
      role="alert"
      className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200"
    >
      {message}
    </div>
  );
}
