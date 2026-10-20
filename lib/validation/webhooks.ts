import { z } from "zod";

export const WEBHOOK_EVENTS = [
  "proof.created",
  "proof.verified",
  "proof.revoked",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * SSRF (Server-Side Request Forgery) detection for webhook URLs.
 * Detects commonly-abused internal IP ranges and hostnames.
 */
function detectSsrfRisk(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  const ip = hostname;

  // Reject localhost and variants
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return "localhost is not allowed";
  }

  // Reject 0.0.0.0
  if (hostname === "0.0.0.0" || hostname === "::") {
    return "Invalid IP address";
  }

  // Reject private IPv4 ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
  if (/^10\./.test(ip) || /^172\.(1[6-9]|2[0-9]|3[01])\./.test(ip) || /^192\.168\./.test(ip)) {
    return "Private IP ranges are not allowed";
  }

  // Reject link-local ranges (169.254.0.0/16 for IPv4, fe80::/10 for IPv6)
  if (/^169\.254\./.test(ip) || /^fe80/i.test(ip)) {
    return "Link-local IP ranges are not allowed";
  }

  // Reject loopback range (127.0.0.0/8)
  if (/^127\./.test(ip)) {
    return "Loopback addresses are not allowed";
  }

  // Reject multicast ranges (224.0.0.0/4 for IPv4, ff00::/8 for IPv6)
  if (/^(22[4-9]|23[0-9])\./.test(ip) || /^ff/i.test(ip)) {
    return "Multicast addresses are not allowed";
  }

  // Reject metadata service URLs (common cloud SSRF targets)
  if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
    return "Cloud metadata services are not allowed";
  }

  return null;
}

/**
 * Validate webhook URL:
 * - Must be HTTPS (http:// is rejected)
 * - Must be a valid URL
 * - Must not target internal/private IP ranges
 * - Must not target localhost or link-local addresses
 */
export function validateWebhookUrl(url: string): { ok: true } | { ok: false; reason: string } {
  const trimmed = url.trim();

  if (!trimmed) {
    return { ok: false, reason: "Webhook URL is required" };
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return { ok: false, reason: "Invalid URL format" };
  }

  // HTTPS-only requirement
  if (parsedUrl.protocol !== "https:") {
    return { ok: false, reason: "Only HTTPS URLs are allowed (http:// is not supported)" };
  }

  // SSRF detection
  const ssrfRisk = detectSsrfRisk(parsedUrl);
  if (ssrfRisk) {
    return { ok: false, reason: ssrfRisk };
  }

  return { ok: true };
}

export const createWebhookSchema = z.object({
  url: z
    .string()
    .min(1, "Webhook URL is required")
    .url("Invalid URL format")
    .refine(
      (url) => url.startsWith("https://"),
      "Only HTTPS URLs are allowed (http:// is not supported)"
    )
    .refine(
      (url) => {
        const result = validateWebhookUrl(url);
        return result.ok;
      },
      (url) => {
        const result = validateWebhookUrl(url);
        return { message: result.ok ? "Valid URL" : result.reason };
      }
    ),
  events: z
    .array(z.enum(WEBHOOK_EVENTS))
    .min(1, "At least one event type is required")
    .refine(
      (events) => new Set(events).size === events.length,
      "Duplicate events are not allowed"
    ),
});

export type CreateWebhookInput = z.infer<typeof createWebhookSchema>;

export const EVENT_DESCRIPTIONS: Record<WebhookEvent, { title: string; description: string }> = {
  "proof.created": {
    title: "Proof Created",
    description: "Fired when a new income or payment proof is created",
  },
  "proof.verified": {
    title: "Proof Verified",
    description: "Fired when a proof passes verification and is confirmed",
  },
  "proof.revoked": {
    title: "Proof Revoked",
    description: "Fired when a proof is revoked and becomes invalid",
  },
};

/**
 * Validate webhook events array
 */
export function validateWebhookEvents(events: string[]): string | null {
  if (events.length === 0) {
    return "At least one event type is required";
  }

  const validEvents = new Set(WEBHOOK_EVENTS);
  const invalidEvents = events.filter((event) => !validEvents.has(event as WebhookEvent));

  if (invalidEvents.length > 0) {
    return `Invalid event types: ${invalidEvents.join(", ")}`;
  }

  const uniqueEvents = new Set(events);
  if (uniqueEvents.size !== events.length) {
    return "Duplicate events are not allowed";
  }

  return null;
}

/**
 * Format SSRF guidance message for display
 */
export function getSsrfGuidance(): string {
  return "Webhook URLs must use HTTPS and cannot target private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x), localhost, link-local addresses, or cloud metadata services. For testing, use a public domain or service like webhook.site.";
}
