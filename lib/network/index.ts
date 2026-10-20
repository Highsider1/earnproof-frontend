/**
 * Network resilience and offline/degraded recovery primitives.
 *
 * Exports:
 * - Error classification: distinguish offline, server, validation, auth failures
 * - Network status: track online/offline and degraded states
 * - Request deduplication: prevent overlapping concurrent requests
 * - Request sequencing: prevent out-of-order responses from overwriting fresh state
 * - Enhanced API errors: carry classification and recovery context
 */

export { type NetworkFailure, type NetworkFailureType, classifyNetworkFailure, canRetry } from "./error-types";

export { type NetworkStatus, useNetworkStatus, recordNetworkFailure, recordNetworkSuccess, setNetworkOnline } from "./use-network-status";

export { ApiNetworkError, isApiNetworkError } from "./api-error";

export {
  dedupRequest,
  cancelPendingRequests,
  clearPendingRequests,
  isPending,
} from "./request-dedup";

export {
  RequestSequencer,
  SequencedResource,
  type SequencedRequest,
} from "./request-sequencing";

export {
  executeWithRetry,
  isMutationSafeToRetry,
  shouldExposeRetry,
  getRecoveryAction,
  type RetryableRequest,
  type RetryConfig,
} from "./retry-orchestrator";

export {
  SensitiveDataPolicy,
  SensitiveDataHolder,
  withSensitiveDataTracking,
  type SensitiveDataCategory,
} from "./sensitive-data-policy";

export {
  useNetworkRecovery,
  useNetworkAwareOperation,
  type RecoveryState,
  type NetworkRecoveryContext,
} from "./use-network-recovery";
