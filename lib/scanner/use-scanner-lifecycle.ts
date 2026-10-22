/**
 * Scanner Lifecycle Hook
 *
 * Manages the complete lifecycle of the QR scanner:
 * - State machine transitions
 * - Media stream ownership
 * - Permission handling
 * - Visibility changes (pause/resume)
 * - Device switching detection
 * - Route transition cleanup
 * - Guaranteed media track cleanup
 *
 * Usage:
 *   const scanner = useScannerLifecycle(videoRef, { onScanSuccess });
 *   scanner.startCamera();
 *   scanner.stopCamera();
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type ScannerState,
  type ScannerError,
  type ScannerStateName,
  SCANNER_STATE_PERMISSION,
  createStartupState,
  createActiveState,
  createSuspendedState,
  createFailureState,
  createStoppedState,
  isValidStateTransition,
  createPermissionDeniedError,
  createPermissionNotSupportedError,
  createCameraNotAvailableError,
  createDetectorNotAvailableError,
  createStreamStoppedError,
  createUnknownError,
} from "./scanner-state";
import {
  type GetMediaStreamResult,
  getMediaStream,
  attachStreamToVideo,
  stopMediaStream,
  detachStreamFromVideo,
  monitorStreamHealth,
  onDeviceChange,
} from "./media-stream-manager";

export interface UseScannerLifecycleOptions {
  /** Callback when user grants camera permission and stream is ready. */
  onCameraReady?: () => void;
  /** Callback when camera is stopped (user cancel, unmount, etc). */
  onCameraStopped?: () => void;
  /** Callback when camera encounters an error. */
  onError?: (error: ScannerError) => void;
  /** Callback when tab visibility changes. */
  onVisibilityChange?: (visible: boolean) => void;
  /** Callback when camera is detected as disconnected. */
  onDeviceDisconnect?: () => void;
}

export interface ScannerLifecycleHandle {
  /** Current scanner state. */
  state: ScannerState;
  /** Start acquiring camera stream. Transitions: permission → startup → active or failure. */
  startCamera: () => Promise<void>;
  /** Stop camera and release all media tracks. Transitions to stopped. */
  stopCamera: () => void;
  /** Pause scanning (tab hidden). Transitions: active → suspended. */
  pauseCamera: () => void;
  /** Resume scanning (tab visible). Transitions: suspended → active. */
  resumeCamera: () => void;
  /** Get current error state. */
  getError: () => ScannerError | undefined;
}

export function useScannerLifecycle(
  videoRef: React.RefObject<HTMLVideoElement>,
  options: UseScannerLifecycleOptions = {},
): ScannerLifecycleHandle {
  const [state, setState] = useState<ScannerState>(SCANNER_STATE_PERMISSION);

  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const streamHealthMonitorRef = useRef<(() => void) | null>(null);
  const deviceChangeListenerRef = useRef<(() => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Tracks whether this hook instance is still mounted. Set to false in the
  // cleanup effect so async continuations after an await can bail out early
  // instead of calling setState / callbacks on an unmounted component.
  const mountedRef = useRef(true);

  /**
   * Transition to a new state with validation.
   * Returns true if transition succeeded, false if invalid.
   */
  const transitionTo = useCallback(
    (newStateName: ScannerStateName, error?: ScannerError): boolean => {
      setState((prevState) => {
        if (!isValidStateTransition(prevState.name, newStateName)) {
          console.warn(
            `[scanner] Invalid transition: ${prevState.name} → ${newStateName}`,
          );
          return prevState;
        }

        let newState: ScannerState;
        if (newStateName === "failure" && error) {
          newState = createFailureState(error);
        } else if (newStateName === "startup") {
          newState = createStartupState();
        } else if (newStateName === "active") {
          newState = createActiveState();
        } else if (newStateName === "suspended") {
          newState = createSuspendedState();
        } else if (newStateName === "stopped") {
          newState = createStoppedState();
        } else {
          newState = SCANNER_STATE_PERMISSION;
        }

        return newState;
      });
      return true;
    },
    [],
  );

  /**
   * Guarantee cleanup of all media resources.
   */
  const cleanup = useCallback(() => {
    // Clear scan timer
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    // Unsubscribe from stream health monitoring
    if (streamHealthMonitorRef.current) {
      streamHealthMonitorRef.current();
      streamHealthMonitorRef.current = null;
    }

    // Unsubscribe from device change events
    if (deviceChangeListenerRef.current) {
      deviceChangeListenerRef.current();
      deviceChangeListenerRef.current = null;
    }

    // Cancel pending getUserMedia requests
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Detach stream from video and stop all tracks
    detachStreamFromVideo(videoRef.current, true);
    stopMediaStream(streamRef.current);
    streamRef.current = null;
  }, [videoRef]);

  /**
   * Stop camera and transition to stopped state.
   * Safe to call multiple times.
   */
  const stopCamera = useCallback(() => {
    cleanup();
    transitionTo("stopped");
    // Fire callback after cleanup and state transition regardless of errors
    try {
      options.onCameraStopped?.();
    } catch {
      // Never let callback errors prevent cleanup completing
    }
  }, [cleanup, transitionTo, options]);

  /**
   * Start camera: acquire media stream and begin scanning.
   * Transitions: permission → startup → active or failure.
   */
  const startCamera = useCallback(async () => {
    // If already starting or active, don't restart
    if (state.isStarting || state.isScanning) {
      return;
    }

    // Transition to startup first — all failure paths below go startup → failure
    transitionTo("startup");

    // Validate prerequisites after entering startup state
    if (!videoRef.current) {
      const error = createUnknownError("video ref is null");
      transitionTo("failure", error);
      options.onError?.(error);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      const error = createPermissionNotSupportedError();
      transitionTo("failure", error);
      options.onError?.(error);
      return;
    }

    if (!window.BarcodeDetector) {
      const error = createDetectorNotAvailableError();
      transitionTo("failure", error);
      options.onError?.(error);
      return;
    }

    // Attempt to acquire media stream
    abortControllerRef.current = new AbortController();
    const mediaResult: GetMediaStreamResult = await getMediaStream({
      facingMode: "environment",
      signal: abortControllerRef.current.signal,
    });
    abortControllerRef.current = null;

    // Bail out if the component unmounted while we were awaiting
    if (!mountedRef.current) {
      if (mediaResult.ok) {
        stopMediaStream(mediaResult.stream);
      }
      return;
    }

    if (!mediaResult.ok) {
      let error: ScannerError;
      switch (mediaResult.reason) {
        case "permission-denied":
          error = createPermissionDeniedError();
          break;
        case "device-not-found":
          error = createCameraNotAvailableError();
          break;
        case "api-not-available":
          error = createPermissionNotSupportedError();
          break;
        case "aborted":
          // User cancelled or component unmounted
          transitionTo("stopped");
          return;
        default:
          error = createUnknownError(mediaResult.reason);
      }

      transitionTo("failure", error);
      options.onError?.(error);
      return;
    }

    streamRef.current = mediaResult.stream;

    // Attach stream to video element
    const attached = await attachStreamToVideo(videoRef.current, mediaResult.stream);

    // Bail out if the component unmounted while we were awaiting play()
    if (!mountedRef.current) {
      stopMediaStream(mediaResult.stream);
      return;
    }

    if (!attached) {
      stopMediaStream(mediaResult.stream);
      streamRef.current = null;
      const error = createUnknownError("failed to attach stream to video");
      transitionTo("failure", error);
      options.onError?.(error);
      return;
    }

    // Monitor stream health for disconnections
    streamHealthMonitorRef.current = monitorStreamHealth(mediaResult.stream, () => {
      const error = createStreamStoppedError();
      transitionTo("failure", error);
      options.onError?.(error);
      stopCamera();
    });

    // Monitor device changes
    deviceChangeListenerRef.current = onDeviceChange(() => {
      options.onDeviceDisconnect?.();
    });

    // Transition to active
    transitionTo("active");
    options.onCameraReady?.();
  }, [state, videoRef, transitionTo, stopCamera, options]);

  /**
   * Pause camera: suspend scanning when tab is hidden.
   * Transitions: active → suspended.
   */
  const pauseCamera = useCallback(() => {
    if (state.name !== "active") {
      return;
    }

    // Stop the scanning loop, but keep the stream and tracks alive
    if (scanTimerRef.current !== null) {
      window.clearTimeout(scanTimerRef.current);
      scanTimerRef.current = null;
    }

    transitionTo("suspended");
    options.onVisibilityChange?.(false);
  }, [state.name, transitionTo, options]);

  /**
   * Resume camera: resume scanning when tab is visible.
   * Transitions: suspended → active.
   */
  const resumeCamera = useCallback(() => {
    if (state.name !== "suspended") {
      return;
    }

    transitionTo("active");
    options.onVisibilityChange?.(true);
  }, [state.name, transitionTo, options]);

  /**
   * Get current error state.
   */
  const getError = useCallback((): ScannerError | undefined => {
    return state.error;
  }, [state.error]);

  /**
   * Handle visibility changes: pause when hidden, resume when visible.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseCamera();
      } else if (state.name === "suspended") {
        resumeCamera();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pauseCamera, resumeCamera, state.name]);

  /**
   * Cleanup on unmount or route change.
   */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    state,
    startCamera,
    stopCamera,
    pauseCamera,
    resumeCamera,
    getError,
  };
}
