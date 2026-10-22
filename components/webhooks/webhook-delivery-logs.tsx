"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listWebhookDeliveries, replayWebhookDelivery, getDeliveryStatusLabel, getDeliveryStatusBadgeColor, formatDeliveryTimestamp } from "@/lib/api/webhooks";
import type { WebhookDelivery } from "@/lib/api/webhooks";

const PAGE_SIZE = 10;

export function WebhookDeliveryLogs({
  token,
  webhookId,
}: {
  token: string;
  webhookId: string;
}) {
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string | undefined>();
  const [selectedEventType, setSelectedEventType] = useState<string | undefined>();
  const [replayingIds, setReplayingIds] = useState<Set<string>>(new Set());
  const [replayMessage, setReplayMessage] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadDeliveries = useCallback(async () => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await listWebhookDeliveries(
        token,
        webhookId,
        {
          page,
          pageSize: PAGE_SIZE,
          status: selectedStatus,
          eventType: selectedEventType,
        },
        controller.signal
      );

      if (!controller.signal.aborted) {
        setDeliveries(response.deliveries);
        setHasMore(response.hasMore);
      }
    } catch {
      if (!controller.signal.aborted) {
        setError("Failed to load delivery logs. Please try again.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [token, webhookId, page, selectedStatus, selectedEventType]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void loadDeliveries();
      }
    });

    return () => {
      active = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadDeliveries]);

  const handleReplay = useCallback(
    async (delivery: WebhookDelivery) => {
      setReplayingIds((prev) => new Set([...prev, delivery.id]));
      setReplayMessage(null);

      try {
        const controller = new AbortController();
        const result = await replayWebhookDelivery(token, webhookId, delivery.id, controller.signal);

        // Check if this is a duplicate (replay was deduplicated vs newly queued)
        const isDuplicate = result.id === delivery.id;
        
        setReplayMessage(
          isDuplicate
            ? `Replay request deduplicated (already in queue)`
            : `Replay queued successfully - delivery ID: ${result.id}`
        );

        // Reload the delivery logs
        await loadDeliveries();
      } catch (err) {
        setReplayMessage(`Failed to replay: ${err instanceof Error ? err.message : "Unknown error"}`);
      } finally {
        setReplayingIds((prev) => {
          const next = new Set(prev);
          next.delete(delivery.id);
          return next;
        });
        // Clear replay message after 5 seconds
        setTimeout(() => setReplayMessage(null), 5000);
      }
    },
    [token, webhookId, loadDeliveries]
  );

  const statuses = ["SUCCESS", "FAILED", "RETRYING", "PENDING"];
  const eventTypes = ["proof.created", "proof.verified", "proof.revoked"];

  return (
    <section className="grid gap-4 rounded-lg border border-white/10 bg-white/[0.04] p-5">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-semibold text-white">Delivery Logs</h2>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            View all webhook deliveries with retry information and replay capability.
          </p>
        </div>
        <button
          className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setPage(1);
            void loadDeliveries();
          }}
          type="button"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-rose-300/30 bg-rose-300/10 p-3">
          <p className="text-sm text-rose-200" role="alert">
            {error}
          </p>
        </div>
      )}

      {replayMessage && (
        <div className={`rounded-md border p-3 ${
          replayMessage.includes("deduplicated")
            ? "border-amber-300/30 bg-amber-300/10"
            : "border-emerald-300/30 bg-emerald-300/10"
        }`}>
          <p className={`text-sm ${
            replayMessage.includes("deduplicated")
              ? "text-amber-200"
              : "text-emerald-200"
          }`} role="alert">
            {replayMessage}
          </p>
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label htmlFor="filter-status" className="block text-xs font-medium text-slate-300 mb-1">
            Filter by Status
          </label>
          <select
            id="filter-status"
            value={selectedStatus ?? ""}
            onChange={(e) => {
              setSelectedStatus(e.target.value || undefined);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
          >
            <option value="">All Statuses</option>
            {statuses.map((status) => (
              <option key={status} value={status}>
                {getDeliveryStatusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-event" className="block text-xs font-medium text-slate-300 mb-1">
            Filter by Event
          </label>
          <select
            id="filter-event"
            value={selectedEventType ?? ""}
            onChange={(e) => {
              setSelectedEventType(e.target.value || undefined);
              setPage(1);
            }}
            className="h-9 w-full rounded-md border border-white/10 bg-slate-900 px-3 text-sm text-white"
          >
            <option value="">All Events</option>
            {eventTypes.map((event) => (
              <option key={event} value={event}>
                {event}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        {deliveries.length === 0 ? (
          <div className="rounded-md border border-white/10 bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-slate-400">
              No deliveries found. Webhook events will appear here once they occur.
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs font-semibold text-slate-300">
                <th className="px-4 py-3">Event Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Status Code</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => {
                const statusColor = getDeliveryStatusBadgeColor(delivery.status);
                const statusLabel = getDeliveryStatusLabel(delivery.status);
                const isReplaying = replayingIds.has(delivery.id);

                return (
                  <tr key={delivery.id} className="border-b border-white/5 hover:bg-white/[0.02] transition">
                    <td className="px-4 py-3 text-xs text-slate-300 font-mono">
                      {delivery.eventType}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          statusColor === "green"
                            ? "bg-emerald-300/20 text-emerald-200"
                            : statusColor === "red"
                            ? "bg-rose-300/20 text-rose-200"
                            : statusColor === "yellow"
                            ? "bg-amber-300/20 text-amber-200"
                            : statusColor === "blue"
                            ? "bg-cyan-300/20 text-cyan-200"
                            : "bg-slate-400/20 text-slate-300"
                        }`}
                      >
                        {statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {delivery.statusCode ? (
                        <span
                          className={
                            delivery.statusCode >= 200 && delivery.statusCode < 300
                              ? "text-emerald-300"
                              : "text-rose-300"
                          }
                        >
                          {delivery.statusCode}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {delivery.attemptCount}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-300">
                      {formatDeliveryTimestamp(delivery.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <button
                        className="inline-flex items-center rounded-md border border-cyan-300/30 px-2.5 py-1.5 text-cyan-200 hover:bg-cyan-300/10 transition disabled:opacity-50"
                        onClick={() => handleReplay(delivery)}
                        disabled={isReplaying}
                        type="button"
                        title="Re-trigger this webhook delivery"
                      >
                        {isReplaying ? "Replaying..." : "Replay"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {deliveries.length > 0 && (
        <div className="flex items-center justify-between">
          <button
            className="h-9 rounded-md border border-white/15 px-3 text-xs font-semibold text-white disabled:opacity-50"
            disabled={page === 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            type="button"
          >
            Previous
          </button>
          <p className="text-xs text-slate-400">
            Page {page} ({deliveries.length} results)
          </p>
          <button
            className="h-9 rounded-md border border-white/15 px-3 text-xs font-semibold text-white disabled:opacity-50"
            disabled={!hasMore}
            onClick={() => setPage((p) => p + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      )}
    </section>
  );
}
