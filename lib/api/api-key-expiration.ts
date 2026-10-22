/**
 * API Key expiration state and warning utilities.
 *
 * Provides deterministic expiration checking and warning tier classification
 * based on UTC/epoch-time comparisons to ensure consistent behavior across timezones.
 *
 * Warning thresholds:
 * - "expiring-very-soon": 2 days or less until expiration
 * - "expiring-soon": 7 days or less until expiration (but more than 2 days)
 * - "expired": already past expiration time
 * - "active": more than 7 days until expiration
 */

/**
 * Expiration warning tier threshold in milliseconds.
 * Keys expiring within this time show the most urgent warning.
 *
 * @constant
 * @type {number}
 */
export const EXPIRATION_VERY_SOON_MS = 2 * 24 * 60 * 60 * 1000; // 2 days

/**
 * Expiration warning tier threshold in milliseconds.
 * Keys expiring within this time (but after the "very soon" threshold)
 * show a moderate warning.
 *
 * @constant
 * @type {number}
 */
export const EXPIRATION_SOON_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Possible expiration warning states.
 */
export type ExpirationWarningTier = "expired" | "expiring-very-soon" | "expiring-soon" | "active";

/**
 * Result of expiration analysis for an API key.
 */
export interface ExpirationStatus {
  tier: ExpirationWarningTier;
  isExpired: boolean;
  isActive: boolean;
  millisecondsUntilExpiry: number | null;
}

/**
 * Determine the expiration warning tier for an API key.
 *
 * Computation is deterministic and UTC-based:
 * - All times are converted to epoch milliseconds (UTC).
 * - Comparisons are done in UTC, not against localized date strings.
 * - The same key will show the same tier regardless of the viewer's timezone.
 *
 * @param expiresAt - The expiration timestamp (ISO 8601 string, Date, or milliseconds)
 * @param now - Current time for comparison (default: Date.now(), can be overridden for testing)
 * @returns ExpirationStatus with tier and timing information
 */
export function getExpirationStatus(
  expiresAt: string | Date | number | null | undefined,
  now: number | Date = Date.now(),
): ExpirationStatus {
  if (!expiresAt) {
    return {
      tier: "active",
      isExpired: false,
      isActive: true,
      millisecondsUntilExpiry: null,
    };
  }

  // Convert all inputs to UTC milliseconds
  const nowMs = now instanceof Date ? now.getTime() : now;
  let expiryMs: number;

  if (typeof expiresAt === "number") {
    expiryMs = expiresAt;
  } else if (expiresAt instanceof Date) {
    expiryMs = expiresAt.getTime();
  } else {
    // Parse ISO 8601 string
    expiryMs = new Date(expiresAt).getTime();
  }

  // Check for invalid date
  if (Number.isNaN(expiryMs)) {
    return {
      tier: "active",
      isExpired: false,
      isActive: true,
      millisecondsUntilExpiry: null,
    };
  }

  const millisecondsUntilExpiry = expiryMs - nowMs;

  // Determine tier based on time until expiry
  if (millisecondsUntilExpiry <= 0) {
    return {
      tier: "expired",
      isExpired: true,
      isActive: false,
      millisecondsUntilExpiry: millisecondsUntilExpiry,
    };
  }

  if (millisecondsUntilExpiry <= EXPIRATION_VERY_SOON_MS) {
    return {
      tier: "expiring-very-soon",
      isExpired: false,
      isActive: false,
      millisecondsUntilExpiry: millisecondsUntilExpiry,
    };
  }

  if (millisecondsUntilExpiry <= EXPIRATION_SOON_MS) {
    return {
      tier: "expiring-soon",
      isExpired: false,
      isActive: true,
      millisecondsUntilExpiry: millisecondsUntilExpiry,
    };
  }

  return {
    tier: "active",
    isExpired: false,
    isActive: true,
    millisecondsUntilExpiry: millisecondsUntilExpiry,
  };
}

/**
 * Determine if an API key is currently valid (not expired).
 *
 * A key is considered valid if it has no expiration date or if the current
 * time is before its expiration time.
 *
 * @param expiresAt - The expiration timestamp
 * @param now - Current time for comparison (default: Date.now())
 * @returns true if the key is valid (not expired), false otherwise
 */
export function isApiKeyValid(
  expiresAt: string | Date | number | null | undefined,
  now: number | Date = Date.now(),
): boolean {
  const status = getExpirationStatus(expiresAt, now);
  return !status.isExpired;
}

/**
 * Determine if an API key requires user action (rotation or attention).
 *
 * Returns true if the key is expiring soon or has expired.
 *
 * @param expiresAt - The expiration timestamp
 * @param now - Current time for comparison (default: Date.now())
 * @returns true if the key requires action, false otherwise
 */
export function requiresExpirationAction(
  expiresAt: string | Date | number | null | undefined,
  now: number | Date = Date.now(),
): boolean {
  const status = getExpirationStatus(expiresAt, now);
  return status.tier === "expired" || status.tier === "expiring-very-soon" || status.tier === "expiring-soon";
}
