"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listPayments } from "@/lib/api/payments";
import { PaymentEligibilityExplanation } from "./payment-eligibility-explanation";
import type { Payment } from "@/lib/api/payments";

/**
 * Fetches and displays one payment's eligibility explanation, refreshing
 * after a classification or policy change (#170's "Refresh explanations
 * after classification or policy changes").
 *
 * There is no GET /payments/{id} endpoint — only the list endpoint — so a
 * refresh re-fetches the full list and finds this payment by id. A
 * `refreshToken` prop lets the parent (e.g. after PATCH
 * /payments/{id}/classification) trigger a refetch without this component
 * needing to know why the underlying data may have changed.
 */
export function PaymentEligibilityPanel({
  token,
  paymentId,
  refreshToken,
}: {
  token: string;
  paymentId: string;
  refreshToken?: number;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    const isCurrent = () => controllerRef.current === controller;

    setLoading(true);
    setError(null);

    try {
      const payments = await listPayments(token, controller.signal);
      if (!isCurrent()) return;

      const found = payments.find((p) => p.id === paymentId) ?? null;
      setPayment(found);
      setIsStale(false);
      if (!found) {
        setError("This payment could not be found.");
      }
    } catch (err) {
      if (!isCurrent()) return;
      // A refresh failing does not clear the last-known explanation — it's
      // marked stale instead, so the UI keeps showing the most recent
      // decision rather than an empty/error state for a payment that was
      // successfully explained a moment ago.
      setIsStale(true);
      setError(err instanceof Error ? err.message : "Failed to refresh eligibility.");
    } finally {
      if (isCurrent()) {
        setLoading(false);
      }
    }
  }, [token, paymentId]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) {
        void load();
      }
    });

    return () => {
      active = false;
      controllerRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, refreshToken]);

  if (loading && !payment) {
    return (
      <div className="rounded-lg border border-white/10 bg-slate-950 p-4 text-center">
        <p className="text-sm text-slate-400">Loading eligibility...</p>
      </div>
    );
  }

  if (!payment) {
    return (
      <div className="rounded-lg border border-rose-300/30 bg-rose-300/10 p-4">
        <p className="text-sm text-rose-200" role="alert">
          {error ?? "This payment could not be found."}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      {error && isStale && (
        <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3">
          <p className="text-xs text-amber-200" role="alert">
            {error}
          </p>
        </div>
      )}
      <PaymentEligibilityExplanation payment={payment} isStale={isStale} />
    </div>
  );
}
