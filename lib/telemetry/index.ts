/**
 * Public surface of the client error telemetry contract.
 *
 * See `docs/observability.md` for the contract itself and the privacy
 * boundaries it guarantees.
 */

export {
  ALLOWED_ERROR_NAMES,
  ALLOWED_EVENT_FIELDS,
  ERROR_CATEGORIES,
  SCHEMA_VERSION,
  isErrorCategory,
  serializeEvent,
  toAllowedErrorName,
  type AllowedEventField,
  type ClientErrorEvent,
  type ErrorCategory,
  type ErrorSeverity,
} from "./schema";

export { MAX_MESSAGE_SHAPE_LENGTH, redactMessage, toEventTimestamp } from "./redact";

export { generateCorrelationId, getPageLoadId, resetPageLoadId } from "./correlation";

export {
  normalizeRate,
  resolveSampleRate,
  shouldSample,
  type SamplingConfig,
} from "./sampling";

export {
  buildClientErrorEvent,
  categorizeError,
  reportClientError,
  type ReportInput,
  type ReporterOptions,
} from "./client-error-reporter";
