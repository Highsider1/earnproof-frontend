import { getStorageValue, removeStorageValue, setStorageValue } from "@/lib/storage";

export interface DraftSaveHandle {
  savedAt: string;
  values: unknown;
}

/** Re-exported so callers of useUnsavedChangesGuard don't need to import
 * from lib/storage directly for this narrow use case. */
export { getStorageValue, removeStorageValue, setStorageValue };

/** Saves (or replaces) one form's draft, keyed by formId, without disturbing
 * any other form's draft already in storage. */
export function saveFormDraft(formId: string, values: unknown): void {
  const current = getStorageValue("FORM_DRAFTS");
  const nextData = { ...(current?.data ?? {}) };
  nextData[formId] = { savedAt: new Date().toISOString(), values };
  setStorageValue("FORM_DRAFTS", { data: nextData });
}

/** Reads back a previously saved draft for formId, if any. */
export function readFormDraft(formId: string): DraftSaveHandle | null {
  const current = getStorageValue("FORM_DRAFTS");
  const entry = current?.data[formId];
  return entry ? { savedAt: entry.savedAt, values: entry.values } : null;
}

/** Removes just formId's draft, preserving any other forms' drafts. */
export function clearFormDraft(formId: string): void {
  const current = getStorageValue("FORM_DRAFTS");
  if (!current || !(formId in current.data)) return;
  const nextData = { ...current.data };
  delete nextData[formId];
  if (Object.keys(nextData).length === 0) {
    removeStorageValue("FORM_DRAFTS");
  } else {
    setStorageValue("FORM_DRAFTS", { data: nextData });
  }
}
