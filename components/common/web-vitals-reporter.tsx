"use client";

import { useCallback } from "react";
import { usePathname } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import { sanitizeMetric, sendWebVital } from "@/lib/diagnostics/web-vitals-sink";

/**
 * Captures LCP, CLS, and interaction latency (INP, or FID as a fallback on
 * older browsers) via Next's built-in Web Vitals hook, strips anything
 * privacy-sensitive, and forwards the result to `sendWebVital`.
 *
 * This is the only client boundary this diagnostic adds: the root layout
 * stays a server component and simply renders this component, matching the
 * pattern Next.js documents for `useReportWebVitals`.
 */
export function WebVitalsReporter() {
  const pathname = usePathname();

  const reportMetric = useCallback(
    (metric: { name: string; value: number; rating?: string; navigationType?: string }) => {
      sendWebVital(sanitizeMetric(metric, pathname ?? "/"));
    },
    [pathname],
  );

  useReportWebVitals(reportMetric);

  return null;
}
