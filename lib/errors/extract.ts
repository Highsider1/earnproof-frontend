import type { ApiErrorResponse } from "./types";

/**
 * Validates and extracts safe request identifiers from API error responses
 * Only allows UUIDs and alphanumeric identifiers (no tokens, credentials, or stack traces)
 */

// UUID v4 format: 8-4-4-4-12 hexadecimal characters
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Alphanumeric with hyphens/underscores, 8-64 characters (excludes JWTs and long tokens)
const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Checks if a string matches a safe identifier format
 */
function isSafeIdentifier(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  // Reject if looks like a JWT (contains dots)
  if (value.includes(".")) {
    return false;
  }

  // Reject if looks like a bearer token (starts with common prefixes)
  const lowerValue = value.toLowerCase();
  if (
    lowerValue.startsWith("bearer ") ||
    lowerValue.startsWith("token ") ||
    lowerValue.startsWith("key_") ||
    lowerValue.startsWith("sk_") ||
    lowerValue.startsWith("pk_")
  ) {
    return false;
  }

  // Accept UUIDs or safe alphanumeric IDs
  return UUID_REGEX.test(value) || SAFE_ID_REGEX.test(value);
}

/**
 * Extracts safe identifiers from API error response body
 * Ignores sensitive fields like tokens, credentials, and stack traces
 */
export function extractSafeErrorReference(
  responseBody: unknown,
  status: number
): ApiErrorResponse {
  const baseError: ApiErrorResponse = {
    status,
    message: `Request failed with status ${status}`,
  };

  // Handle non-object responses
  if (!responseBody || typeof responseBody !== "object") {
    return baseError;
  }

  const body = responseBody as Record<string, unknown>;

  // Extract message if available
  if (typeof body.message === "string" && body.message.length > 0) {
    baseError.message = body.message;
  } else if (typeof body.error === "string" && body.error.length > 0) {
    baseError.message = body.error;
  }

  // Extract request ID (common field names)
  const requestIdFields = ["requestId", "request_id", "traceId", "trace_id"];
  for (const field of requestIdFields) {
    if (isSafeIdentifier(body[field])) {
      baseError.requestId = body[field] as string;
      break;
    }
  }

  // Extract correlation ID (common field names)
  const correlationIdFields = [
    "correlationId",
    "correlation_id",
    "xRequestId",
    "x_request_id",
  ];
  for (const field of correlationIdFields) {
    if (isSafeIdentifier(body[field])) {
      baseError.correlationId = body[field] as string;
      break;
    }
  }

  return baseError;
}
