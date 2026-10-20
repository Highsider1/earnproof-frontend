"use client";

import { useState } from "react";
import { SHARE_EXPIRY_OPTIONS_HOURS } from "@/lib/validation/proof-sharing";

const EXPIRY_LABELS: Record<number, string> = {
  1: "1 hour",
  24: "1 day",
  72: "3 days",
  168: "7 days",
};

export function CreateShareLinkForm({
  onCreate,
  creating,
}: {
  onCreate: (input: { expiresInHours: number; discloseAmount: boolean; discloseSender: boolean }) => void;
  creating: boolean;
}) {
  const [expiresInHours, setExpiresInHours] = useState<number>(SHARE_EXPIRY_OPTIONS_HOURS[1]);
  const [discloseAmount, setDiscloseAmount] = useState(false);
  const [discloseSender, setDiscloseSender] = useState(false);

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Create a share link</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Choose an expiry and what this link discloses. The reviewed policy below is exactly
          what will be created.
        </p>
      </div>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-200">Expires in</legend>
        {SHARE_EXPIRY_OPTIONS_HOURS.map((hours) => (
          <label key={hours} className="flex items-center gap-3 text-sm text-slate-200">
            <input
              type="radio"
              name="share-expiry"
              checked={expiresInHours === hours}
              onChange={() => setExpiresInHours(hours)}
              className="h-4 w-4"
            />
            {EXPIRY_LABELS[hours]}
          </label>
        ))}
      </fieldset>

      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-200">Disclosure policy</legend>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={discloseAmount}
            onChange={(event) => setDiscloseAmount(event.target.checked)}
            className="h-4 w-4"
          />
          Disclose exact amount
        </label>
        <label className="flex items-center gap-3 text-sm text-slate-200">
          <input
            type="checkbox"
            checked={discloseSender}
            onChange={(event) => setDiscloseSender(event.target.checked)}
            className="h-4 w-4"
          />
          Disclose sender
        </label>
      </fieldset>

      <div className="rounded-md border border-white/10 bg-slate-950 p-3 text-xs text-slate-300">
        <p className="font-semibold text-white">This link will:</p>
        <ul className="mt-1 grid gap-1">
          <li>Expire in {EXPIRY_LABELS[expiresInHours]}</li>
          <li>{discloseAmount ? "Disclose" : "Hide"} the exact amount</li>
          <li>{discloseSender ? "Disclose" : "Hide"} the sender</li>
        </ul>
      </div>

      <button
        type="button"
        disabled={creating}
        onClick={() => onCreate({ expiresInHours, discloseAmount, discloseSender })}
        className="h-10 w-fit rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 disabled:opacity-50"
      >
        {creating ? "Creating..." : "Create share link"}
      </button>
    </section>
  );
}
