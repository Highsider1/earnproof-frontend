"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createBackfillRequestSchema,
  estimatedScopeDays,
  type CreateBackfillRequestInput,
} from "@/lib/validation/payment-backfill";
import {
  createBackfillJob,
  ConflictingBackfillError,
  type BackfillJobRecord,
} from "@/lib/payment-backfill/store";

export function CreateBackfillForm({
  userId,
  onJobCreated,
}: {
  userId: string;
  onJobCreated: (job: BackfillJobRecord) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateBackfillRequestInput>();

  const rangeStart = watch("rangeStart");
  const rangeEnd = watch("rangeEnd");
  const scopeDays =
    rangeStart && rangeEnd ? estimatedScopeDays(rangeStart, rangeEnd) : 0;

  const onSubmit = useCallback(
    (data: CreateBackfillRequestInput) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const validated = createBackfillRequestSchema.parse(data);
        const job = createBackfillJob(userId, validated);
        onJobCreated(job);
        reset({ rangeStart: "", rangeEnd: "" });
      } catch (err) {
        if (err instanceof ConflictingBackfillError) {
          setError(
            "A backfill for an overlapping range is already in progress. Wait for it to finish or choose a different range.",
          );
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to request backfill. Please check the range and try again.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [userId, onJobCreated, reset],
  );

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Request Payment Backfill</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Request re-synchronization of payments over a bounded date range.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <label htmlFor="range-start" className="text-xs font-semibold uppercase text-slate-400">
            Range start
          </label>
          <input
            id="range-start"
            type="datetime-local"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
            aria-invalid={errors.rangeStart ? "true" : "false"}
            aria-describedby={errors.rangeStart ? "range-start-error" : undefined}
            {...register("rangeStart", { required: "Range start is required" })}
          />
          {errors.rangeStart && (
            <p id="range-start-error" className="text-xs text-rose-300" role="alert">
              {errors.rangeStart.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="range-end" className="text-xs font-semibold uppercase text-slate-400">
            Range end
          </label>
          <input
            id="range-end"
            type="datetime-local"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
            aria-invalid={errors.rangeEnd ? "true" : "false"}
            aria-describedby={errors.rangeEnd ? "range-end-error" : undefined}
            {...register("rangeEnd", { required: "Range end is required" })}
          />
          {errors.rangeEnd && (
            <p id="range-end-error" className="text-xs text-rose-300" role="alert">
              {errors.rangeEnd.message}
            </p>
          )}
        </div>

        {scopeDays > 0 && (
          <div className="sm:col-span-2 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3 text-sm text-cyan-100">
            Estimated scope: {scopeDays} day{scopeDays === 1 ? "" : "s"}
          </div>
        )}

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
            disabled={isSubmitting}
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Requesting..." : "Request backfill"}
          </button>
        </div>
      </form>
    </section>
  );
}
