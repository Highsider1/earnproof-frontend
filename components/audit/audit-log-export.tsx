"use client";

import { useState } from "react";
import { ArtifactExport } from "@/components/proofs/artifact-export";
import { buildAuditLogExport, type ExportableAuditLogEntry } from "@/lib/credentials/export";

export function AuditLogExport({ entries }: { entries: ExportableAuditLogEntry[] }) {
  const [redactActors, setRedactActors] = useState(true);

  return (
    <div className="grid gap-3 rounded-md border border-white/10 bg-slate-950 p-4">
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input checked={redactActors} onChange={(event) => setRedactActors(event.target.checked)} type="checkbox" />
        Redact actor identifiers (recommended)
      </label>
      <ArtifactExport plan={buildAuditLogExport(entries, { redactActors })} title="Export audit log" />
    </div>
  );
}
