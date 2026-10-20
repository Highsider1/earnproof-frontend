"use client";

import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";
import {
  createSupportedAssetSchema,
  isNativeAssetCode,
  type CreateSupportedAssetInput,
} from "@/lib/validation/supported-assets";
import {
  createSupportedAsset,
  DuplicateSupportedAssetError,
  type SupportedAssetRecord,
} from "@/lib/supported-assets/store";

export function CreateSupportedAssetForm({
  onAssetCreated,
}: {
  onAssetCreated: (record: SupportedAssetRecord) => void;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<CreateSupportedAssetInput>({
    defaultValues: { network: "testnet" },
  });

  const assetCode = watch("assetCode") ?? "";
  const isNative = isNativeAssetCode(assetCode);

  const onSubmit = useCallback(
    (data: CreateSupportedAssetInput) => {
      setIsSubmitting(true);
      setError(null);

      try {
        const validated = createSupportedAssetSchema.parse(data);
        const record = createSupportedAsset(validated);
        onAssetCreated(record);
        reset({ assetCode: "", assetIssuer: "", network: validated.network });
      } catch (err) {
        if (err instanceof DuplicateSupportedAssetError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to create supported asset. Please check your input and try again.",
          );
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [onAssetCreated, reset],
  );

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Add Supported Asset</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Register a Stellar asset for indexing and use in proofs. Use XLM for the
          native asset; any other code requires the issuing account.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-1.5">
          <label htmlFor="asset-code" className="text-xs font-semibold uppercase text-slate-400">
            Asset code
          </label>
          <input
            id="asset-code"
            type="text"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none"
            placeholder="XLM or USDC"
            aria-invalid={errors.assetCode ? "true" : "false"}
            aria-describedby={errors.assetCode ? "asset-code-error" : undefined}
            {...register("assetCode", { required: "Asset code is required" })}
          />
          {errors.assetCode && (
            <p id="asset-code-error" className="text-xs text-rose-300" role="alert">
              {errors.assetCode.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="asset-issuer" className="text-xs font-semibold uppercase text-slate-400">
            Issuer {isNative && <span className="text-slate-500">(not applicable to XLM)</span>}
          </label>
          <input
            id="asset-issuer"
            type="text"
            disabled={isNative}
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-300/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="GISSUER..."
            aria-invalid={errors.assetIssuer ? "true" : "false"}
            aria-describedby={errors.assetIssuer ? "asset-issuer-error" : undefined}
            {...register("assetIssuer")}
          />
          {errors.assetIssuer && (
            <p id="asset-issuer-error" className="text-xs text-rose-300" role="alert">
              {errors.assetIssuer.message}
            </p>
          )}
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="asset-network" className="text-xs font-semibold uppercase text-slate-400">
            Network
          </label>
          <select
            id="asset-network"
            className="h-10 rounded-md border border-white/15 bg-slate-950 px-3 text-sm text-white focus:border-cyan-300/50 focus:outline-none"
            {...register("network", { required: true })}
          >
            <option value="testnet">Testnet</option>
            <option value="mainnet">Mainnet</option>
          </select>
        </div>

        {error && (
          <div className="sm:col-span-3 rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
            <p className="text-sm text-rose-200" role="alert">
              {error}
            </p>
          </div>
        )}

        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Adding..." : "Add supported asset"}
          </button>
        </div>
      </form>
    </section>
  );
}
