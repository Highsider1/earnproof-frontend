"use client";

import { useRef, useState } from "react";
import {
  testTrustedSourceConnection,
  type ConnectionTestResult,
  type TrustedSourceConfig,
} from "@/lib/api/trusted-sources";
import { formatDateTime } from "@/lib/i18n";

const STATUS_LABEL: Record<ConnectionTestResult["status"], string> = {
  success: "Connected",
  timeout: "Timed out",
  unauthorized: "Unauthorized",
  "schema-mismatch": "Unexpected response",
  "network-error": "Network error",
};

interface TrustedSourceFormProps {
  token: string;
  onSave: (config: TrustedSourceConfig) => void;
}

export function TrustedSourceForm({ token, onSave }: TrustedSourceFormProps) {
  const [config, setConfig] = useState<TrustedSourceConfig>({
    name: "",
    endpoint: "",
    apiKey: "",
  });
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const updateField = <K extends keyof TrustedSourceConfig>(
    field: K,
    value: TrustedSourceConfig[K]
  ) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
    // Any config change invalidates a prior successful test result, so a
    // stale "Connected" status can never be shown for a since-edited source.
    setTestResult(null);
  };

  const handleTestConnection = async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setTesting(true);
    setTestResult(null);
    try {
      const result = await testTrustedSourceConnection(token, config, controller.signal);
      if (!controller.signal.aborted) {
        setTestResult(result);
      }
    } finally {
      if (!controller.signal.aborted) {
        setTesting(false);
      }
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    onSave(config);
  };

  const isTestDisabled = testing || !config.endpoint.trim() || !config.apiKey.trim();

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div>
        <h2 className="text-xl font-semibold text-white">Trusted source</h2>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Verify a trusted source is reachable before saving its configuration.
        </p>
      </div>

      <label className="grid gap-1 text-sm text-slate-300">
        Name
        <input
          className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
          value={config.name}
          onChange={(e) => updateField("name", e.target.value)}
          required
        />
      </label>

      <label className="grid gap-1 text-sm text-slate-300">
        Endpoint
        <input
          className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
          value={config.endpoint}
          onChange={(e) => updateField("endpoint", e.target.value)}
          placeholder="https://example.com/api"
          required
        />
      </label>

      <label className="grid gap-1 text-sm text-slate-300">
        API key
        <input
          className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-sm text-white"
          type="password"
          value={config.apiKey}
          onChange={(e) => updateField("apiKey", e.target.value)}
          autoComplete="off"
          required
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTestDisabled}
          className="h-9 rounded-md border border-white/15 px-4 text-xs font-semibold text-white hover:bg-white/5 disabled:opacity-50 transition"
        >
          {testing ? "Testing..." : "Test connection"}
        </button>
        <button
          type="submit"
          className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-semibold text-slate-950 hover:bg-cyan-200 transition"
        >
          Save
        </button>
      </div>

      {testResult && (
        <div
          role={testResult.status === "success" ? "status" : "alert"}
          className={`rounded-md border p-3 text-sm ${
            testResult.status === "success"
              ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200"
              : "border-rose-300/30 bg-rose-300/10 text-rose-200"
          }`}
        >
          <p className="font-semibold">{STATUS_LABEL[testResult.status]}</p>
          <p className="mt-1 text-xs opacity-90">{testResult.message}</p>
          <p className="mt-1 text-xs opacity-70">
            Tested at {formatDateTime(testResult.testedAt)}
          </p>
        </div>
      )}
    </form>
  );
}
