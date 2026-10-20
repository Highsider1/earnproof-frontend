"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { clearFormDraft, readFormDraft, saveFormDraft, type DraftSaveHandle } from "./drafts";

export interface UnsavedChangesGuardOptions {
  /** Unique id for this form, used both for draft storage and to keep
   * multiple mounted guards from interfering with each other. */
  formId: string;
  /** True while the form has changes that have not been saved/submitted. */
  isDirty: boolean;
}

export interface PendingNavigation {
  /** Continue past the guard (discard changes) and, if a navigation was
   * pending, allow it to proceed. */
  discard: () => void;
  /** Save a draft, then continue. */
  saveDraft: (values: unknown) => void;
  /** Stay on the page / cancel the pending navigation. */
  stay: () => void;
}

/**
 * A shared dirty-form guard: warns before a browser refresh/close
 * (beforeunload) and exposes a guardedNavigate() function components can
 * call instead of router.push directly, which pauses to ask the user
 * whether to stay, discard, or save a draft before actually navigating.
 *
 * Next.js's App Router has no navigation-interception hook (no
 * `router.events`, no `useBlocker`) — the only way to gate an internal
 * navigation is for the navigating code to call guardedNavigate() instead
 * of router.push() directly, which this hook provides.
 */
export function useUnsavedChangesGuard({
  formId,
  isDirty,
}: UnsavedChangesGuardOptions) {
  const [pending, setPending] = useState<PendingNavigation | null>(null);
  const isDirtyRef = useRef(isDirty);

  useEffect(() => {
    isDirtyRef.current = isDirty;
  }, [isDirty]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirtyRef.current) return;
      event.preventDefault();
      // Chrome requires returnValue to be set for the native prompt to show.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const guardedNavigate = useCallback(
    (navigate: () => void) => {
      if (!isDirtyRef.current) {
        navigate();
        return;
      }
      setPending({
        discard: () => {
          setPending(null);
          navigate();
        },
        saveDraft: (values: unknown) => {
          saveFormDraft(formId, values);
          setPending(null);
          navigate();
        },
        stay: () => setPending(null),
      });
    },
    [formId],
  );

  const clearDraft = useCallback(() => clearFormDraft(formId), [formId]);
  const loadDraft = useCallback((): DraftSaveHandle | null => readFormDraft(formId), [formId]);

  return {
    /** Non-null while the guard's stay/discard/draft prompt should be shown. */
    pending,
    /** Call instead of router.push()/back() etc. Shows the prompt first if dirty. */
    guardedNavigate,
    /** Call after a successful submit or explicit reset to drop any saved draft. */
    clearDraft,
    /** Read back a previously saved draft for this form, if any. */
    loadDraft,
  };
}
