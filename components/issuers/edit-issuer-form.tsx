"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import { updateIssuer } from "@/lib/api/issuers";
import { updateIssuerSchema, type UpdateIssuerInput } from "@/lib/validation/issuers";
import type { Issuer, Organization } from "@/lib/api/generated/v1";

/**
 * Edits an issuer's name and organization association (#141's "metadata
 * editing"). The Issuer schema has no other editable fields beyond
 * name/organizationId/status — status transitions are handled separately
 * by IssuerList's activate/suspend/revoke actions, so this form is scoped
 * to the two fields updateIssuerSchema actually validates.
 */
export function EditIssuerForm({
  issuer,
  token,
  organizations,
  onIssuerUpdated,
  onCancel,
}: {
  issuer: Issuer;
  token: string;
  organizations: Organization[];
  onIssuerUpdated: (issuer: Issuer) => void;
  onCancel: () => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateIssuerInput>({
    defaultValues: {
      name: issuer.name,
      organizationId: issuer.organizationId ?? "",
    },
  });

  const onSubmit = useCallback(
    async (data: UpdateIssuerInput) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const validated = updateIssuerSchema.parse(data);
        const controller = new AbortController();
        const updated = await updateIssuer(
          token,
          issuer.id,
          {
            name: validated.name,
            // An empty selection means "no organization"; the backend
            // schema has no way to represent "unset" other than omitting
            // the field, which PATCH semantics treat as "leave unchanged"
            // rather than "clear" — this repo's Organization type has no
            // sentinel for that, so this matches CreateIssuerForm's own
            // existing behavior of only ever sending an id.
            organizationId: validated.organizationId || undefined,
          },
          controller.signal,
        );
        onIssuerUpdated(updated);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update issuer. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [token, issuer.id, onIssuerUpdated],
  );

  const activeOrganizations = organizations.filter((org) => org.status === "ACTIVE");

  return (
    <form
      className="grid gap-4 rounded-md border border-cyan-300/30 bg-cyan-300/5 p-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-slate-200" htmlFor={`edit-issuer-name-${issuer.id}`}>
            Issuer Name
          </label>
          <input
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
            id={`edit-issuer-name-${issuer.id}`}
            type="text"
            {...register("name", {
              required: "Issuer name is required",
              minLength: { value: 2, message: "Name must be at least 2 characters" },
              maxLength: { value: 100, message: "Name must be less than 100 characters" },
            })}
          />
          {errors.name && (
            <p className="mt-1 text-xs text-rose-200" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div>
          <label
            className="block text-xs font-medium text-slate-200"
            htmlFor={`edit-issuer-org-${issuer.id}`}
          >
            Organization
          </label>
          <select
            className="mt-1 h-10 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
            id={`edit-issuer-org-${issuer.id}`}
            {...register("organizationId")}
          >
            <option value="">No organization</option>
            {activeOrganizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <p className="text-xs text-rose-200" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <button
          className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Saving..." : "Save changes"}
        </button>
        <button
          className="h-9 rounded-md border border-white/15 px-4 text-xs font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={isSubmitting}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
