/**
 * Scanner Lifecycle State Machine
 *
 * Defines explicit states for the QR scanner lifecycle with clear transition rules.
 * This centralized model replaces scattered boolean flags and makes state transitions
 * explicit and auditable.
 *
 * State Transitions:
 * - permission → startup (user allows camera)
 * - startup → active (stream acquired, scanning begins)
 * - startup → failure (getUserMedia failed, device unavailable)
 * - active → suspended (tab hidden, manual pause)
 * - suspended → active (tab visible, manual resume)
 * - active → failure (scanner error, device disconnect)
 * - failure → permission (user retries, clears error state)
 * - active/suspended → stopped (user cancels, route changes, unmount)
 * - Any state → stopped (cleanup, route transition)
 */

export type ScannerStateName =
  | "permission"
  | "startup"
  | "active"
  | "suspended"
  | "failure"
  | "stopped";

export interface ScannerState {
  /** Current lifecycle state. */
  name: ScannerStateName;
  /** Human-readable status message for UI and screen readers. */
  statusMessage: string;
  /** Error details if state is 'failure'. */
  error?: ScannerError;
  /** Whether camera stream is actively acquiring media. */
  isStarting: boolean;
  /** Whether QR scanning loop is running. */
  isScanning: boolean;
  /** Whether media tracks are being held (startup, active, suspended). */
  hasActiveStream: boolean;
}

export interface ScannerError {
  code:
    | "permission-denied"
    | "permission-not-supported"
    | "camera-not-available"
    | "detector-not-available"
    | "detector-error"
    | "device-disconnect"
    | "stream-stopped"
    | "unknown";
  message: string;
  userMessage: string;
  recoverable: boolean;
}

/** Initial state: waiting for user to allow camera. */
export const SCANNER_STATE_PERMISSION: ScannerState = {
  name: "permission",
  statusMessage: "Camera is idle. You can allow the camera, upload an image, or enter a proof ID.",
  isStarting: false,
  isScanning: false,
  hasActiveStream: false,
};

/** Transitional state: acquiring media stream from device. */
export function createStartupState(): ScannerState {
  return {
    name: "startup",
    statusMessage: "Requesting camera permission.",
    isStarting: true,
    isScanning: false,
    hasActiveStream: false,
  };
}

/** Active state: scanning QR codes. */
export function createActiveState(): ScannerState {
  return {
    name: "active",
    statusMessage: "Camera is scanning. Center one EarnProof QR code in the frame.",
    isStarting: false,
    isScanning: true,
    hasActiveStream: true,
  };
}

/** Suspended state: media stream held but scanning paused (tab hidden, user pause). */
export function createSuspendedState(): ScannerState {
  return {
    name: "suspended",
    statusMessage: "Camera is paused. Bring this tab to the foreground to resume scanning.",
    isStarting: false,
    isScanning: false,
    hasActiveStream: true,
  };
}

/** Failure state: camera unavailable or scanner error. */
export function createFailureState(error: ScannerError): ScannerState {
  return {
    name: "failure",
    statusMessage: error.userMessage,
    error,
    isStarting: false,
    isScanning: false,
    hasActiveStream: false,
  };
}

/** Stopped state: all media released, no active scanning. */
export function createStoppedState(): ScannerState {
  return {
    name: "stopped",
    statusMessage: "Scanning stopped.",
    isStarting: false,
    isScanning: false,
    hasActiveStream: false,
  };
}

/**
 * Validate that a state transition is legal. Returns true if the transition
 * is allowed, false otherwise. Helps catch invalid state sequences.
 */
export function isValidStateTransition(from: ScannerStateName, to: ScannerStateName): boolean {
  const validTransitions: Record<ScannerStateName, Set<ScannerStateName>> = {
    permission: new Set(["startup", "stopped"]),
    startup: new Set(["active", "failure", "stopped"]),
    active: new Set(["suspended", "failure", "stopped"]),
    suspended: new Set(["active", "failure", "stopped"]),
    failure: new Set(["permission", "startup", "stopped"]),
    stopped: new Set([]), // stopped is terminal within a component lifecycle
  };

  return validTransitions[from]?.has(to) ?? false;
}

/** Error factory: permission was denied by browser. */
export function createPermissionDeniedError(): ScannerError {
  return {
    code: "permission-denied",
    message: "User denied camera permission.",
    userMessage:
      "Camera access was denied or unavailable. Upload a QR image or enter the proof ID instead.",
    recoverable: true,
  };
}

/** Error factory: permission API not available. */
export function createPermissionNotSupportedError(): ScannerError {
  return {
    code: "permission-not-supported",
    message: "Camera API not available in this browser.",
    userMessage:
      "Camera scanning is not available in this browser. Upload an image or enter the proof ID.",
    recoverable: false,
  };
}

/** Error factory: no camera device available. */
export function createCameraNotAvailableError(): ScannerError {
  return {
    code: "camera-not-available",
    message: "No camera device is available.",
    userMessage: "No camera is available on this device. Upload an image or enter the proof ID.",
    recoverable: false,
  };
}

/** Error factory: BarcodeDetector API not available. */
export function createDetectorNotAvailableError(): ScannerError {
  return {
    code: "detector-not-available",
    message: "BarcodeDetector API is not available.",
    userMessage:
      "Live QR scanning is not available in this browser. Upload an image or enter the proof ID.",
    recoverable: false,
  };
}

/** Error factory: detector threw an error during scanning. */
export function createDetectorError(cause: unknown): ScannerError {
  return {
    code: "detector-error",
    message: `Detector error: ${cause instanceof Error ? cause.message : String(cause)}`,
    userMessage: "We could not read that QR code. Center it in the frame and try again.",
    recoverable: true,
  };
}

/** Error factory: device was disconnected or stream stopped unexpectedly. */
export function createDeviceDisconnectError(): ScannerError {
  return {
    code: "device-disconnect",
    message: "Camera device was disconnected.",
    userMessage: "Camera was disconnected. Check the device and try again.",
    recoverable: true,
  };
}

/** Error factory: media stream ended unexpectedly. */
export function createStreamStoppedError(): ScannerError {
  return {
    code: "stream-stopped",
    message: "Media stream stopped unexpectedly.",
    userMessage: "Camera connection was lost. Try again.",
    recoverable: true,
  };
}

/** Error factory: unknown error. */
export function createUnknownError(cause: unknown): ScannerError {
  return {
    code: "unknown",
    message: `Unknown error: ${cause instanceof Error ? cause.message : String(cause)}`,
    userMessage: "An unexpected error occurred. Try again.",
    recoverable: true,
  };
}
