/**
 * Media Stream Manager
 *
 * Centralized ownership of media stream lifecycle:
 * - Acquiring streams from getUserMedia()
 * - Attaching streams to video elements
 * - Releasing all tracks safely
 * - Preventing duplicate streams
 * - Handling edge cases (missing video element, partial init)
 *
 * This is the single source of truth for all media operations. Components
 * that use this manager cannot accidentally leak tracks or create orphaned streams.
 */

/**
 * Options for acquiring a media stream.
 */
export interface GetMediaStreamOptions {
  /** Preferred facing mode: "user" (front) or "environment" (rear). Default: "environment". */
  facingMode?: "user" | "environment";
  /** Abort signal to cancel the request. */
  signal?: AbortSignal;
}

/**
 * Result of a media stream acquisition attempt.
 */
export type GetMediaStreamResult =
  | { ok: true; stream: MediaStream }
  | { ok: false; reason: "api-not-available" | "permission-denied" | "device-not-found" | "aborted" | "unknown" };

/**
 * Acquire a media stream with optional facing preference.
 *
 * @param options Configuration for the media stream request.
 * @returns Result object with stream or error reason.
 */
export async function getMediaStream(
  options: GetMediaStreamOptions = {},
): Promise<GetMediaStreamResult> {
  const { facingMode = "environment", signal } = options;

  // Check API availability
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: false, reason: "api-not-available" };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
      },
      ...(signal && { signal }),
    });

    return { ok: true, stream };
  } catch (cause) {
    if (cause instanceof DOMException) {
      if (cause.name === "NotAllowedError" || cause.name === "SecurityError") {
        return { ok: false, reason: "permission-denied" };
      }
      if (cause.name === "NotFoundError" || cause.name === "DevicesNotFoundError") {
        return { ok: false, reason: "device-not-found" };
      }
      if (cause.name === "AbortError") {
        return { ok: false, reason: "aborted" };
      }
    }
    // Any other error (plain Error, OverconstrainedError, etc.) is treated as
    // permission-denied — it is the most actionable recovery path for the user
    // and matches what browsers typically surface for blocked camera access.
    return { ok: false, reason: "permission-denied" };
  }
}

/**
 * Attach a media stream to a video element, starting playback.
 *
 * @param video The video element to attach to.
 * @param stream The media stream to attach.
 * @returns true if attachment and playback started, false otherwise.
 */
export async function attachStreamToVideo(
  video: HTMLVideoElement,
  stream: MediaStream,
): Promise<boolean> {
  try {
    video.srcObject = stream;
  } catch {
    // srcObject assignment failed (e.g. in test environments)
    return false;
  }
  try {
    await video.play();
    return true;
  } catch {
    // play() failed — clear the stream to prevent orphaned tracks
    try {
      video.srcObject = null;
    } catch {
      // Ignore secondary cleanup error
    }
    return false;
  }
}

/**
 * Stop all tracks in a media stream. Safe to call multiple times.
 *
 * This is the fundamental cleanup operation. It must be called whenever
 * a stream is no longer needed to prevent resource leaks.
 *
 * @param stream The stream to release.
 */
export function stopMediaStream(stream: MediaStream | null | undefined): void {
  if (!stream) {
    return;
  }

  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Silently ignore errors stopping individual tracks.
      // A track may already be stopped or in an invalid state.
    }
  });
}

/**
 * Detach a stream from a video element and optionally stop all tracks.
 *
 * @param video The video element to detach from.
 * @param stopStream If true, also stops all media tracks in the stream.
 */
export function detachStreamFromVideo(
  video: HTMLVideoElement | null | undefined,
  stopStream: boolean = true,
): void {
  if (!video) {
    return;
  }

  const stream = video.srcObject as MediaStream | null;

  // Stop playback
  try {
    video.pause();
  } catch {
    // Ignore pause errors
  }

  // Clear the srcObject reference
  video.srcObject = null;

  // Stop all tracks if requested
  if (stopStream) {
    stopMediaStream(stream);
  }
}

/**
 * Check if a stream is still active (has running tracks).
 *
 * @param stream The stream to check.
 * @returns true if the stream has at least one active track, false otherwise.
 */
export function isStreamActive(stream: MediaStream | null | undefined): boolean {
  if (!stream) {
    return false;
  }

  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.some((track) => track.readyState === "live");
}

/**
 * Monitor a media stream for unexpected termination (device disconnect, etc).
 *
 * Returns a cleanup function that removes the listeners.
 *
 * @param stream The stream to monitor.
 * @param onStreamEnded Callback when the stream ends unexpectedly.
 * @returns Cleanup function to remove listeners.
 */
export function monitorStreamHealth(
  stream: MediaStream,
  onStreamEnded: () => void,
): () => void {
  const handleTrackEnded = () => {
    // If any track ends unexpectedly while the stream is still attached,
    // the stream may be in an unusable state. Notify the caller.
    onStreamEnded();
  };

  const tracks = stream.getTracks();
  tracks.forEach((track) => {
    track.addEventListener("ended", handleTrackEnded);
  });

  // Return cleanup function
  return () => {
    tracks.forEach((track) => {
      track.removeEventListener("ended", handleTrackEnded);
    });
  };
}

/**
 * Handle device change events (camera switched, device plugged/unplugged).
 *
 * Returns a cleanup function that removes the listener.
 *
 * @param onDeviceChange Callback when input devices change.
 * @returns Cleanup function to remove listener.
 */
export function onDeviceChange(onDeviceChange: () => void): () => void {
  if (!navigator.mediaDevices?.addEventListener) {
    return () => {
      // No-op cleanup
    };
  }

  navigator.mediaDevices.addEventListener("devicechange", onDeviceChange);

  return () => {
    navigator.mediaDevices?.removeEventListener("devicechange", onDeviceChange);
  };
}
