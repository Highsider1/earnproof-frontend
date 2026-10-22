"use client";

import { scopeCatalogEntry, incompatibleScopePairs } from "@/lib/validation/scope-catalog";

export interface PermissionReviewProps {
  keyName: string;
  scopes: string[];
  expiresInDays?: number;
}

/**
 * A plain-language summary of exactly what a set of scopes will grant,
 * shown before the key is actually created (#181's "plain-language
 * permission summary before key creation" and "warn when broad or
 * incompatible scopes are selected" criteria). Renders every selected
 * scope from scopeCatalogEntry rather than displaying the scope keys
 * directly, so an unrecognized scope is surfaced as a warning instead of
 * silently appearing reviewed and approved.
 */
export function PermissionReview({ keyName, scopes, expiresInDays }: PermissionReviewProps) {
  const known = scopes
    .map((scope) => scopeCatalogEntry(scope))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  const unknownScopes = scopes.filter((scope) => scopeCatalogEntry(scope) === null);
  const broadScopesSelected = known.filter((entry) => entry.isBroad);
  const conflicts = incompatibleScopePairs(scopes);

  return (
    <div className="grid gap-4 rounded-md border border-white/10 bg-slate-950 p-4">
      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Key name
        </div>
        <div className="mt-1 text-sm text-white">{keyName}</div>
      </div>

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          This key will be able to
        </div>
        <ul className="mt-2 grid gap-2">
          {known.map((entry) => (
            <li key={entry.scope} className="flex items-start gap-2 text-sm text-slate-200">
              <span aria-hidden className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-300" />
              <span>
                {entry.description || entry.title}
                {entry.isBroad && (
                  <span className="ml-2 rounded bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                    Broad
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Expiration
        </div>
        <div className="mt-1 text-sm text-slate-200">
          {expiresInDays ? `In ${expiresInDays} day${expiresInDays === 1 ? "" : "s"}` : "Never"}
        </div>
      </div>

      {unknownScopes.length > 0 && (
        <p role="alert" className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3 text-sm text-rose-200">
          {unknownScopes.length === 1
            ? `"${unknownScopes[0]}" is not a recognized scope and will not be included.`
            : `The following are not recognized scopes and will not be included: ${unknownScopes.join(", ")}.`}
        </p>
      )}

      {broadScopesSelected.length > 0 && (
        <p role="alert" className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-200">
          This key includes {broadScopesSelected.length === 1 ? "a broad permission" : "broad permissions"} that
          can create, modify, or delete data, not just read it. Only grant{" "}
          {broadScopesSelected.length === 1 ? "it" : "these"} to integrations that need{" "}
          {broadScopesSelected.length === 1 ? "it" : "them"}.
        </p>
      )}

      {conflicts.length > 0 && (
        <p role="alert" className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-200">
          Some selected scopes conflict with each other:{" "}
          {conflicts.map(([a, b]) => `"${a}" and "${b}"`).join(", ")}.
        </p>
      )}
    </div>
  );
}
