"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createTrustedSourceSchema,
  type CreateTrustedSourceInput,
} from "@/lib/validation/trusted-sources";
import { createTrustedSource, type TrustedSourceRecord } from "@/lib/trusted-sources/store";
import type { Issuer } from "@/lib/api/generated/v1";

export function CreateTrustedSourceForm({
  userId,
  issuers,
  onTrustedSourceCreated,
}: {
  userId: string;
  issuers: Issuer[];
  onTrustedSourceCreated: (record: TrustedSourceRecord) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateTrustedSourceInput>();

  const onSubmit = useCallback(
    (data: CreateTrustedSourceInput) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const validated = createTrustedSourceSchema.parse(data);

        // Issuer linkage must resolve against a real, currently-listed
        // issuer before the source is created (#135's own acceptance
        // criterion), even though this store itself is client-local.
        const issuer = issuers.find((i) => i.id === validated.issuerId);
        if (!issuer) {
          setError("Select a valid issuer to link this trusted source to.");
          return;
        }

        const record = createTrustedSource(userId, validated);
        onTrustedSourceCreated(record);
        reset();
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Failed to create trusted source. Please check your input and try again.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, issuers, onTrustedSourceCreated, reset],
  );

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Add Trusted Source</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Register a trusted source and link it to an issuer for verification.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="trusted-source-name" className="text-xs font-semibold uppercase text-slate-400">
            Name
          </label>
          <input
            id="trusted-source-name"
            type="text"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
            placeholder="e.g. Acme Payroll"
            aria-invalid={errors.name ? "true" : "false"}
            aria-describedby={errors.name ? "trusted-source-name-error" : undefined}
            {...register("name", { required: "Name is required" })}
          />
          {errors.name && (
            <p id="trusted-source-name-error" className="text-xs text-rose-300" role="alert">
              {errors.name.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="trusted-source-issuer" className="text-xs font-semibold uppercase text-slate-400">
            Linked issuer
          </label>
          <select
            id="trusted-source-issuer"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            aria-invalid={errors.issuerId ? "true" : "false"}
            aria-describedby={errors.issuerId ? "trusted-source-issuer-error" : undefined}
            disabled={issuers.length === 0}
            defaultValue=""
            {...register("issuerId", { required: "An issuer must be selected" })}
          >
            <option value="" disabled>
              {issuers.length === 0 ? "No issuers available" : "Select an issuer"}
            </option>
            {issuers.map((issuer) => (
              <option key={issuer.id} value={issuer.id}>
                {issuer.name}
              </option>
            ))}
          </select>
          {errors.issuerId && (
            <p id="trusted-source-issuer-error" className="text-xs text-rose-300" role="alert">
              {errors.issuerId.message}
            </p>
          )}
        </div>

        {error && (
          <div className="sm:col-span-2 rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting || issuers.length === 0}
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add trusted source"}
          </button>
        </div>
      </form>
    </section>
  );
}
