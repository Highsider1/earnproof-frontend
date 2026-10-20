# Error Handling with Support-Safe Request IDs

This module provides safe error handling with support-safe request identifiers for API failures.

## Overview

The error handling system extracts allowlisted request and correlation identifiers from API error responses, while explicitly rejecting sensitive data like tokens, credentials, and stack traces.

## Components

### `lib/errors/types.ts`
- **`ApiErrorResponse`**: Type representing a safe error response
- **`ApiError`**: Custom error class with request/correlation IDs

### `lib/errors/extract.ts`
- **`extractSafeErrorReference()`**: Validates and extracts safe identifiers from API responses
- **Validation rules**:
  - Accepts: UUIDs (v4 format) and alphanumeric IDs (8-64 characters)
  - Rejects: JWTs (contains `.`), bearer tokens, API keys (`key_`, `sk_`, `pk_` prefixes)
  - Ignores: Sensitive fields like credentials, tokens, stack traces

### `components/common/error-reference.tsx`
- **`ErrorReference`**: UI component that displays errors with copy functionality
- Shows request ID and correlation ID when available
- Provides accessible copy button with visual feedback
- Falls back to simple error display when no IDs are present

## Usage

### In API Client

The `apiClient` automatically extracts safe error references:

```typescript
import { apiClient } from "@/lib/api/client";

try {
  const data = await apiClient({ path: "/api/resource" });
} catch (error) {
  // error is an ApiError with requestId and correlationId if available
  console.log(error.requestId); // "req-abc123xyz"
  console.log(error.correlationId); // "corr-def456uvw"
}
```

### In UI Components

Use the `ErrorReference` component to display errors:

```typescript
import { ErrorReference } from "@/components/common/error-reference";

function MyComponent() {
  const [error, setError] = useState<Error | null>(null);

  // ... API call that catches error

  return (
    <div>
      {error && <ErrorReference error={error} />}
    </div>
  );
}
```

## Security

### What is Extracted
- Request IDs in UUID format: `550e8400-e29b-41d4-a716-446655440000`
- Alphanumeric identifiers: `req-abc123xyz`, `trace_12345678`
- Correlation/trace IDs: `corr-xyz-987654`

### What is Rejected
- JWT tokens (contain `.` separators)
- Bearer tokens (`Bearer ...`)
- API keys (`key_`, `sk_`, `pk_` prefixes)
- IDs shorter than 8 characters
- IDs longer than 64 characters
- Non-string values

### Protected Fields
The extraction function only reads from allowlisted field names:
- Request ID fields: `requestId`, `request_id`, `traceId`, `trace_id`
- Correlation ID fields: `correlationId`, `correlation_id`, `xRequestId`, `x_request_id`

All other fields (including `stack`, `credentials`, `authorization`) are ignored.

## Testing

Comprehensive test coverage includes:
- ✅ Positive cases: Valid UUID and alphanumeric IDs
- ✅ Negative cases: Rejection of sensitive data (JWTs, tokens, keys)
- ✅ Boundary cases: Edge cases for validation rules
- ✅ Security regression: Protection against credential leaks
- ✅ UI tests: Copy functionality, accessibility, error states

Run tests:
```bash
npm run test
```

## API Response Format

Your API should return error responses in this format:

```json
{
  "message": "Resource not found",
  "requestId": "req-abc123xyz789",
  "correlationId": "trace-correlate-123"
}
```

Only the `message` field is required. Request and correlation IDs are optional but recommended for support debugging.
