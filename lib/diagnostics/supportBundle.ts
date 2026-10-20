import packageJson from "../../package.json";
import { toRoutePattern } from "./sanitize";
import { redactMessage } from "@/lib/telemetry/redact";
import { getPageLoadId } from "@/lib/telemetry/correlation";

/** Feature-detection results, matching the exact matrix documented in
 * docs/browser-support.md so a support ticket can be cross-referenced
 * against that table directly. */
export type SupportFeatureFlags = {
  clipboard: boolean;
  camera: boolean;
  barcodeDetector: boolean;
  sendBeacon: boolean;
};

export type SupportHealthSnapshot = {
  /** "unknown" when the health check hasn't resolved, has failed, or the
   * app is being diagnosed from a route where no check has run yet.
   * Bundle generation never blocks on or fails because of this field. */
  status: "unknown" | string;
};

export type SupportBundleFieldKey =
  | "appVersion"
  | "route"
  | "correlationId"
  | "features"
  | "health"
  | "generatedAt";

export type SupportBundle = {
  appVersion: string;
  route: string;
  correlationId: string;
  features: SupportFeatureFlags;
  health: SupportHealthSnapshot;
  generatedAt: string;
};

/** Fields a user may opt out of including, per the issue's "cancel or
 * remove optional fields" requirement. appVersion/route/correlationId are
 * always included since they carry no user-identifying content and are
 * essential to triage; features/health are the only fields worth omitting
 * (they reveal environment details some users may prefer not to share). */
export const OPTIONAL_SUPPORT_BUNDLE_FIELDS: readonly SupportBundleFieldKey[] = [
  "features",
  "health",
];

function detectFeatures(): SupportFeatureFlags {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { clipboard: false, camera: false, barcodeDetector: false, sendBeacon: false };
  }
  return {
    clipboard: Boolean(navigator.clipboard?.writeText),
    camera: Boolean(navigator.mediaDevices?.getUserMedia),
    barcodeDetector: Boolean((window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector),
    sendBeacon: Boolean(navigator.sendBeacon),
  };
}

/**
 * Best-effort health lookup for the diagnostics bundle. Mirrors
 * useHealthCheck's contract of never throwing past its own boundary —
 * bundle generation must succeed even when the health/telemetry backend is
 * unreachable, per this issue's "generation works after API failure"
 * acceptance criterion. `fetchHealth` is injectable for tests and defaults
 * to a real, short-timeout fetch.
 */
// lib/health-check.ts only ever distinguishes "ok" from anything else
// (data.status !== "ok" is treated as errored) — mirror that exactly rather
// than passing arbitrary server text through. Health status is
// server-controlled input, so accepting a free-form string here (even after
// best-effort shape-based redaction) would let a compromised or
// misbehaving backend smuggle content into a diagnostics bundle a user
// might paste into a support ticket or forum post.
async function readHealthStatus(
  fetchHealth: () => Promise<{ status?: unknown } | null> = defaultFetchHealth,
): Promise<SupportHealthSnapshot> {
  try {
    const result = await fetchHealth();
    return { status: result?.status === "ok" ? "ok" : "unknown" };
  } catch {
    return { status: "unknown" };
  }
}

async function defaultFetchHealth(): Promise<{ status?: unknown } | null> {
  if (typeof fetch === "undefined") return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch("/api/health", { signal: controller.signal });
    if (!res.ok) return null;
    return (await res.json()) as { status?: unknown };
  } finally {
    clearTimeout(timeout);
  }
}

/** Redacts any string value in the bundle through the existing telemetry
 * redaction rules before it is ever assembled into the final object,
 * satisfying "apply the existing telemetry redaction rules to all values." */
function redactField(value: string): string {
  if (value.length === 0) return value;
  return redactMessage(value);
}

export interface BuildSupportBundleOptions {
  pathname: string;
  /** Which optional fields to include; defaults to all of them. */
  includeFields?: readonly SupportBundleFieldKey[];
  /** Injectable for tests; see readHealthStatus. */
  fetchHealth?: () => Promise<{ status?: unknown } | null>;
}

export async function buildSupportBundle(
  options: BuildSupportBundleOptions,
): Promise<SupportBundle> {
  const includeFields = new Set(options.includeFields ?? OPTIONAL_SUPPORT_BUNDLE_FIELDS);

  const route = redactField(toRoutePattern(options.pathname));
  const correlationId = getPageLoadId();

  const features = includeFields.has("features")
    ? detectFeatures()
    : { clipboard: false, camera: false, barcodeDetector: false, sendBeacon: false };

  const health = includeFields.has("health")
    ? await readHealthStatus(options.fetchHealth)
    : { status: "unknown" as const };

  return {
    appVersion: packageJson.version,
    route,
    correlationId,
    features,
    health,
    generatedAt: new Date().toISOString(),
  };
}
