"use client";

import { useCallback, useRef, useState } from "react";
import {
  verifyDeploymentMetadata,
  blocksProtectedWorkflow,
  type DeploymentMetadataState,
} from "./deployment-metadata";

export interface DeploymentMetadataGateResult {
  state: DeploymentMetadataState | null;
  isChecking: boolean;
  /**
   * Verifies deployment metadata, then runs `action` only if the result
   * doesn't block. Callers use this to wrap a wallet-signature request
   * (#185: "metadata verification happens before requesting a wallet
   * signature"). Returns the verification state either way, so the caller
   * can render the degraded state (stale/mismatched/malformed/unavailable)
   * without needing a second round trip.
   */
  runIfVerified: (action: () => void | Promise<void>) => Promise<DeploymentMetadataState>;
}

/**
 * Gates a wallet-signing action behind a fresh, verified deployment-metadata
 * check. Every call re-verifies rather than caching a prior "valid" result,
 * since the whole point is to catch a deployment that changed (or was
 * compromised) between one signing operation and the next - see #185's
 * "no unsigned fallback is accepted in production" criterion.
 */
export function useDeploymentMetadataGate(): DeploymentMetadataGateResult {
  const [state, setState] = useState<DeploymentMetadataState | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const runIfVerified = useCallback(async (action: () => void | Promise<void>) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsChecking(true);
    try {
      const result = await verifyDeploymentMetadata(controller.signal);
      if (controller.signal.aborted) return result;

      setState(result);
      if (!blocksProtectedWorkflow(result)) {
        await action();
      }
      return result;
    } finally {
      if (!controller.signal.aborted) {
        setIsChecking(false);
      }
    }
  }, []);

  return { state, isChecking, runIfVerified };
}
