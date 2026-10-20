"use client";

import { useState, useCallback } from "react";
import { ApiConflictError } from "@/lib/api/client";
import type { ConflictValue } from "@/components/forms/resolve-conflict-dialog";

export interface ConflictState {
  isActive: boolean;
  conflicts: ConflictValue[];
  serverEntity?: unknown;
  localFormState: Record<string, unknown>;
}

export interface UseConflictResolutionOptions {
  /** Function to reload the entity from the server */
  onReloadEntity: () => Promise<void>;
  /** Function to handle retry after reviewing conflicts */
  onRetrySubmit: (formState: Record<string, unknown>) => Promise<void>;
}

/**
 * Hook to manage conflict resolution flow.
 * 
 * Usage:
 * ```tsx
 * const {
 *   conflict,
 *   showConflict,
 *   resolveConflict,
 *   abandonConflict,
 * } = useConflictResolution({ onReloadEntity, onRetrySubmit });
 * 
 * // In submit handler:
 * try {
 *   await submitForm();
 * } catch (error) {
 *   if (error instanceof ApiConflictError) {
 *     showConflict(error, formState);
 *   }
 * }
 * ```
 */
export function useConflictResolution({
  onReloadEntity,
  onRetrySubmit,
}: UseConflictResolutionOptions) {
  const [conflict, setConflict] = useState<ConflictState>({
    isActive: false,
    conflicts: [],
    localFormState: {},
  });
  const [isRetrying, setIsRetrying] = useState(false);
  const [isReloading, setIsReloading] = useState(false);

  /**
   * Show the conflict dialog with detected conflicts.
   * Compares server entity values with local form state to identify what changed.
   */
  const showConflict = useCallback(
    (error: ApiConflictError, localFormState: Record<string, unknown>, entityFields?: string[]) => {
      const serverEntity = error.serverEntity as Record<string, unknown> | undefined;
      if (!serverEntity) {
        console.error("Conflict error missing server entity");
        return;
      }

      // Determine which fields to compare (all provided fields, or intersection of server + local)
      const fieldsToCompare = entityFields ?? Object.keys(serverEntity);

      // Build conflict array by comparing each field
      const conflicts: ConflictValue[] = fieldsToCompare
        .filter((field) => !field.startsWith("_")) // Skip internal fields like __revision
        .map((field) => {
          const serverValue = serverEntity[field];
          const localValue = localFormState[field];
          const changed = serverValue !== localValue;

          return {
            field,
            label: formatFieldLabel(field),
            serverValue,
            localValue,
            changed,
          };
        })
        .filter((conflict) => conflict.serverValue !== undefined || conflict.localValue !== undefined);

      setConflict({
        isActive: true,
        conflicts,
        serverEntity,
        localFormState,
      });
    },
    []
  );

  /**
   * Handle the "Reload" button: discard local edits and reload server data.
   */
  const handleReload = useCallback(async () => {
    setIsReloading(true);
    try {
      await onReloadEntity();
      setConflict({ isActive: false, conflicts: [], localFormState: {} });
    } catch (error) {
      console.error("Failed to reload entity", error);
      // Leave conflict dialog open; user can retry or abandon
    } finally {
      setIsReloading(false);
    }
  }, [onReloadEntity]);

  /**
   * Handle the "Retry" button: submit again with local changes.
   */
  const handleRetry = useCallback(
    async (formState: Record<string, unknown>) => {
      setIsRetrying(true);
      try {
        await onRetrySubmit(formState);
        // Success: close the dialog
        setConflict({ isActive: false, conflicts: [], localFormState: {} });
      } catch (error) {
        console.error("Retry submission failed", error);
        // If another conflict, the caller should handle it
        // For now, leave dialog open so user can try again
      } finally {
        setIsRetrying(false);
      }
    },
    [onRetrySubmit]
  );

  /**
   * Handle the "Keep Editing" button: close dialog and return to form with local edits intact.
   */
  const handleAbandon = useCallback(() => {
    setConflict({ isActive: false, conflicts: [], localFormState: {} });
  }, []);

  return {
    conflict,
    isRetrying,
    isReloading,
    showConflict,
    handleReload,
    handleRetry,
    handleAbandon,
  };
}

/**
 * Convert a field name to a user-friendly label.
 * Examples: "organizationId" -> "Organization", "name" -> "Name"
 */
function formatFieldLabel(field: string): string {
  // Remove common suffixes
  let label = field
    .replace(/Id$/, "")
    .replace(/At$/, "");

  // Convert camelCase to Title Case
  label = label
    .replace(/([A-Z])/g, " $1")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  return label;
}
