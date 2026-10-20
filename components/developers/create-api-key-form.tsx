"use client";

import { useCallback, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { createApiKey, type CreateApiKeyResponse } from "@/lib/api/keys";
import { type CreateApiKeyInput } from "@/lib/validation/api-keys";
import { scopeCatalogByCategory, hasBroadScope } from "@/lib/validation/scope-catalog";
import { PermissionReview } from "./permission-review";

export function CreateApiKeyForm({
  token,
  onKeyCreated,
}: {
  token: string;
  onKeyCreated: (response: CreateApiKeyResponse) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReview, setPendingReview] = useState<CreateApiKeyInput | null>(null);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CreateApiKeyInput>({
    defaultValues: {
      name: "",
      scopes: [],
      expiresInDays: 90,
    },
  });

  const selectedScopes = useWatch({ control, name: "scopes" }) || [];

  const startReview = useCallback((data: CreateApiKeyInput) => {
    setError(null);
    setPendingReview(data);
  }, []);

  const confirmCreate = useCallback(async () => {
    if (!pendingReview) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const controller = new AbortController();
      const response = await createApiKey(token, pendingReview, controller.signal);
      onKeyCreated(response);
      reset(); // Clear form after successful creation
      setPendingReview(null);
    } catch {
      setError("Failed to create API key. Please check your input and try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [token, pendingReview, onKeyCreated, reset]);

  if (pendingReview) {
    return (
      <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
        <div>
          <h2 className="text-xl font-semibold text-white">Review permissions</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            Confirm this is exactly what you want to grant before the key is created.
          </p>
        </div>

        <PermissionReview
          keyName={pendingReview.name}
          scopes={pendingReview.scopes}
          expiresInDays={pendingReview.expiresInDays}
        />

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setPendingReview(null)}
            disabled={isSubmitting}
            className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50 hover:bg-white/5 transition"
          >
            Back
          </button>
          <button
            type="button"
            onClick={confirmCreate}
            disabled={isSubmitting}
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-200 transition"
          >
            {isSubmitting ? "Creating..." : "Create API Key"}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Create API Key</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Generate a new API key with specific scopes. Follow the principle of least privilege by selecting only the permissions you need.
        </p>
      </div>

      <form onSubmit={handleSubmit(startReview)} className="grid gap-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="key-name" className="block text-sm font-medium text-slate-200">
              Key Name
            </label>
            <input
              id="key-name"
              type="text"
              className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white placeholder:text-slate-400"
              placeholder="My App Integration"
              {...register("name", {
                required: "API key name is required",
                minLength: {
                  value: 3,
                  message: "Name must be at least 3 characters"
                },
                maxLength: {
                  value: 64,
                  message: "Name must be less than 64 characters"
                },
                pattern: {
                  value: /^[a-zA-Z0-9\s\-_.]+$/,
                  message: "Name can only contain letters, numbers, spaces, hyphens, underscores, and periods"
                }
              })}
            />
            {errors.name && (
              <p className="mt-1 text-xs text-rose-200" role="alert">
                {errors.name.message}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="expires-in-days" className="block text-sm font-medium text-slate-200">
              Expires In (Days)
            </label>
            <input
              id="expires-in-days"
              type="number"
              min="1"
              max="365"
              className="mt-1 h-11 w-full rounded-md border border-white/10 bg-slate-900 px-4 text-white placeholder:text-slate-400"
              {...register("expiresInDays", {
                valueAsNumber: true,
                min: {
                  value: 1,
                  message: "Expiry must be at least 1 day"
                },
                max: {
                  value: 365,
                  message: "Expiry cannot exceed 365 days"
                }
              })}
            />
            {errors.expiresInDays && (
              <p className="mt-1 text-xs text-rose-200" role="alert">
                {errors.expiresInDays.message}
              </p>
            )}
            <p className="mt-1 text-xs text-slate-400">
              Optional. Leave empty for no expiration.
            </p>
          </div>
        </div>

        <div>
          <fieldset>
            <legend className="text-sm font-medium text-slate-200">
              Scopes (Select at least one)
            </legend>
            <p className="mt-1 text-xs text-slate-400">
              Grant the minimum permissions required for your integration.
            </p>
            <div className="mt-3 grid gap-5">
              {scopeCatalogByCategory().map((group) => (
                <div key={group.category}>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {group.label}
                  </h3>
                  <div className="mt-2 grid gap-3">
                    {group.scopes.map((entry) => {
                      const isChecked = selectedScopes.includes(entry.scope);

                      return (
                        <label
                          key={entry.scope}
                          className={`flex gap-3 rounded-md border p-3 cursor-pointer transition ${
                            isChecked
                              ? "border-cyan-300/50 bg-cyan-300/5"
                              : "border-white/10 bg-transparent hover:bg-white/[0.02]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            value={entry.scope}
                            {...register("scopes", {
                              required: "At least one scope is required"
                            })}
                            className="mt-1 h-4 w-4"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-white">
                              {entry.title}
                              {entry.isBroad && (
                                <span className="rounded bg-amber-300/10 px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-200">
                                  Broad
                                </span>
                              )}
                            </div>
                            {entry.description && (
                              <div className="mt-1 text-xs text-slate-300">
                                {entry.description}
                              </div>
                            )}
                            <div className="mt-1 text-xs text-slate-400 font-mono">
                              {entry.scope}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {errors.scopes && (
              <p className="mt-2 text-xs text-rose-200" role="alert">
                {errors.scopes.message}
              </p>
            )}
            {hasBroadScope(selectedScopes) && (
              <p className="mt-3 rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-xs text-amber-200">
                One or more selected scopes are broad: they can create, modify, or delete data, not just read it.
              </p>
            )}
          </fieldset>
        </div>

        {error && (
          <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={selectedScopes.length === 0}
          className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-cyan-200 transition"
        >
          Review permissions
        </button>
      </form>
    </section>
  );
}
