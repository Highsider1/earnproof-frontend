/**
 * Error normalization layer for API responses.
 * 
 * Handles:
 * - 409 Conflict responses (concurrent edits, version mismatches)
 * - 400 Bad Request with field-level validation errors
 * - 422 Unprocessable Entity with validation details
 * - Generic form-level errors
 * 
 * Normalizes all error responses into a consistent shape that components
 * can render predictably across forms and UI.
 */

export type FormError = {
  type: "form" | "field" | "conflict" | "unknown";
  message: string;
  details?: Record<string, string | string[]>;
  statusCode?: number;
  retryable: boolean;
};

export type FieldErrors = Record<string, string | string[]>;

/**
 * Normalized error response that components can render
 */
export interface NormalizedError {
  message: string;
  type: "validation" | "conflict" | "authorization" | "network" | "unknown";
  fieldErrors: FieldErrors;
  statusCode?: number;
  isRetryable: boolean;
  originalError?: Error;
}

/**
 * Try to parse a response as JSON, return fallback if parsing fails
 */
function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Extract field-level errors from API response
 */
function extractFieldErrors(data: unknown): FieldErrors {
  if (!data || typeof data !== "object") {
    return {};
  }

  const obj = data as Record<string, unknown>;
  const fieldErrors: FieldErrors = {};

  // Handle various field error patterns
  if (obj.errors && typeof obj.errors === "object") {
    const errors = obj.errors as Record<string, unknown>;
    for (const [field, error] of Object.entries(errors)) {
      if (typeof error === "string") {
        fieldErrors[field] = error;
      } else if (Array.isArray(error)) {
        fieldErrors[field] = error.filter((e) => typeof e === "string");
      } else if (error && typeof error === "object" && "message" in error) {
        fieldErrors[field] = (error as { message: string }).message;
      }
    }
  }

  // Handle validation_errors field (common in some APIs)
  if (obj.validation_errors && typeof obj.validation_errors === "object") {
    const validationErrors = obj.validation_errors as Record<string, unknown>;
    for (const [field, error] of Object.entries(validationErrors)) {
      if (typeof error === "string") {
        fieldErrors[field] = error;
      } else if (Array.isArray(error)) {
        fieldErrors[field] = error.filter((e) => typeof e === "string");
      }
    }
  }

  // Handle fieldErrors field
  if (obj.fieldErrors && typeof obj.fieldErrors === "object") {
    const errors = obj.fieldErrors as Record<string, unknown>;
    for (const [field, error] of Object.entries(errors)) {
      if (typeof error === "string") {
        fieldErrors[field] = error;
      } else if (Array.isArray(error)) {
        fieldErrors[field] = error.filter((e) => typeof e === "string");
      }
    }
  }

  return fieldErrors;
}

/**
 * Extract a user-friendly message from the error response
 */
function extractErrorMessage(
  data: unknown,
  defaultMessage: string
): string {
  if (!data || typeof data !== "object") {
    return defaultMessage;
  }

  const obj = data as Record<string, unknown>;

  // Try common message field names
  if (obj.message && typeof obj.message === "string") {
    return obj.message;
  }
  if (obj.error && typeof obj.error === "string") {
    return obj.error;
  }
  if (obj.detail && typeof obj.detail === "string") {
    return obj.detail;
  }
  if (obj.title && typeof obj.title === "string") {
    return obj.title;
  }

  return defaultMessage;
}

/**
 * Normalize a 409 Conflict response
 */
function normalizeConflictError(
  responseBody: unknown,
  originalError: Error
): NormalizedError {
  const message = extractErrorMessage(
    responseBody,
    "Resource was modified concurrently. Please refresh and try again."
  );

  return {
    message,
    type: "conflict",
    fieldErrors: extractFieldErrors(responseBody),
    statusCode: 409,
    isRetryable: true,
    originalError,
  };
}

/**
 * Normalize a 400/422 validation error response
 */
function normalizeValidationError(
  responseBody: unknown,
  statusCode: number,
  originalError: Error
): NormalizedError {
  const message = extractErrorMessage(
    responseBody,
    statusCode === 422
      ? "The provided data is invalid."
      : "Invalid input. Please check the highlighted fields."
  );

  const fieldErrors = extractFieldErrors(responseBody);

  return {
    message,
    type: "validation",
    fieldErrors,
    statusCode,
    isRetryable: false,
    originalError,
  };
}

/**
 * Normalize a 401/403 authorization error
 */
function normalizeAuthorizationError(
  statusCode: number,
  originalError: Error
): NormalizedError {
  const message =
    statusCode === 401
      ? "You are not authenticated. Please sign in."
      : "You do not have permission to perform this action.";

  return {
    message,
    type: "authorization",
    fieldErrors: {},
    statusCode,
    isRetryable: false,
    originalError,
  };
}

/**
 * Normalize a network error
 */
function normalizeNetworkError(originalError: Error): NormalizedError {
  const isTimeoutError =
    originalError.name === "AbortError" ||
    originalError.message.toLowerCase().includes("timeout") ||
    originalError.message.toLowerCase().includes("aborted");

  const message = isTimeoutError
    ? "Request timed out. Please check your connection and try again."
    : "Network error. Please check your connection and try again.";

  return {
    message,
    type: "network",
    fieldErrors: {},
    isRetryable: true,
    originalError,
  };
}

/**
 * Main normalization function
 * 
 * Takes a thrown error (likely from fetch/API call) and normalizes it
 * into a consistent shape that UI components can render predictably.
 * 
 * Handles:
 * - HTTP errors with status codes and response bodies
 * - Network errors and timeouts
 * - Parse errors
 * - Unknown error types
 */
export async function normalizeError(
  error: unknown
): Promise<NormalizedError> {
  if (!(error instanceof Error)) {
    return {
      message: "An unexpected error occurred.",
      type: "unknown",
      fieldErrors: {},
      isRetryable: false,
      originalError: new Error(String(error)),
    };
  }

  // Handle network errors and timeouts
  if (error.name === "AbortError" || !("statusCode" in error)) {
    // Try to extract statusCode if it's in the error message
    const match = error.message.match(/status[:\s]+(\d+)/i);
    if (match) {
      const statusCode = parseInt(match[1], 10);
      let responseBody: unknown = null;

      if ("body" in error && typeof error.body === "string") {
        responseBody = tryParseJson(error.body);
      }

      if (statusCode === 409) {
        return normalizeConflictError(responseBody, error);
      }
      if (statusCode === 400 || statusCode === 422) {
        return normalizeValidationError(responseBody, statusCode, error);
      }
      if (statusCode === 401 || statusCode === 403) {
        return normalizeAuthorizationError(statusCode, error);
      }
    }

    return normalizeNetworkError(error);
  }

  // Handle HTTP errors with status code
  if ("statusCode" in error) {
    const statusCode = error.statusCode as number;
    let responseBody: unknown = null;

    if ("body" in error && typeof error.body === "string") {
      responseBody = tryParseJson(error.body);
    } else if ("response" in error) {
      responseBody = error.response;
    }

    if (statusCode === 409) {
      return normalizeConflictError(responseBody, error);
    }
    if (statusCode === 400 || statusCode === 422) {
      return normalizeValidationError(responseBody, statusCode, error);
    }
    if (statusCode === 401 || statusCode === 403) {
      return normalizeAuthorizationError(statusCode, error);
    }

    // Generic HTTP error
    const message = extractErrorMessage(
      responseBody,
      `Request failed with status ${statusCode}`
    );

    return {
      message,
      type: "unknown",
      fieldErrors: extractFieldErrors(responseBody),
      statusCode,
      isRetryable: statusCode >= 500, // Retry on server errors
      originalError: error,
    };
  }

  // Unknown error
  return {
    message: "An unexpected error occurred.",
    type: "unknown",
    fieldErrors: {},
    isRetryable: false,
    originalError: error,
  };
}

/**
 * Helper to check if an error is a validation error
 */
export function isValidationError(error: NormalizedError): boolean {
  return error.type === "validation" || Object.keys(error.fieldErrors).length > 0;
}

/**
 * Helper to check if an error is a conflict
 */
export function isConflictError(error: NormalizedError): boolean {
  return error.type === "conflict";
}

/**
 * Helper to check if error is retryable
 */
export function isRetryableError(error: NormalizedError): boolean {
  return error.isRetryable;
}

/**
 * Helper to format field errors for display
 */
export function formatFieldErrors(fieldErrors: FieldErrors): FieldErrors {
  return Object.fromEntries(
    Object.entries(fieldErrors).map(([field, error]) => [
      field,
      Array.isArray(error) ? error[0] : error,
    ])
  );
}
