/**
 * @jest-environment jsdom
 */

import { renderHook, act, waitFor } from "@testing-library/react";
import { useScannerLifecycle } from "../use-scanner-lifecycle";
import * as mediaStreamManager from "../media-stream-manager";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));

// Mock media stream manager
jest.mock("../media-stream-manager");

// Stub browser APIs required by useScannerLifecycle guards
beforeAll(() => {
  // BarcodeDetector guard
  if (!("BarcodeDetector" in window)) {
    Object.defineProperty(window, "BarcodeDetector", {
      value: jest.fn(),
      configurable: true,
      writable: true,
    });
  }
  // mediaDevices guard
  if (!navigator.mediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: jest.fn(), addEventListener: jest.fn(), removeEventListener: jest.fn() },
      configurable: true,
    });
  }
});

// Default mock implementations for all media manager functions.
// Called after clearAllMocks to restore safe defaults.
function applyDefaultMocks(videoRef: React.RefObject<HTMLVideoElement>) {
  videoRef = { current: document.createElement("video") };
  (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({ ok: false, reason: "aborted" });
  (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(false);
  (mediaStreamManager.stopMediaStream as jest.Mock).mockReturnValue(undefined);
  (mediaStreamManager.detachStreamFromVideo as jest.Mock).mockReturnValue(undefined);
  (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
  (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});
  return videoRef;
}

describe("useScannerLifecycle - State Machine", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("initializes in permission state", () => {
    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    expect(result.current.state.name).toBe("permission");
    expect(result.current.state.isScanning).toBe(false);
    expect(result.current.state.hasActiveStream).toBe(false);
  });

  it("transitions to startup when startCamera is called", async () => {
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: {
        getTracks: () => [],
      },
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("startup");
    });
  });

  it("transitions from startup to active on successful stream acquisition", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
      expect(result.current.state.isScanning).toBe(true);
    });
  });

  it("transitions to stopped when stopCamera is called", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(result.current.state.name).toBe("stopped");
  });
});

describe("useScannerLifecycle - Permission Handling", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("transitions to failure on permission denied", async () => {
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "permission-denied",
    });

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("failure");
      expect(result.current.getError()?.code).toBe("permission-denied");
      expect(result.current.getError()?.recoverable).toBe(true);
    });
  });

  it("calls onError callback when permission denied", async () => {
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "permission-denied",
    });

    const onError = jest.fn();
    const { result } = renderHook(() => useScannerLifecycle(videoRef, { onError }));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: "permission-denied" }));
    });
  });

  it("allows retry from failure state to permission state", async () => {
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "permission-denied",
    });

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("failure");
    });

    // Reset mock to succeed
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: { getTracks: () => [] },
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    // Retry should work if state allows
    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("startup");
    });
  });

  it("handles detector unavailable error", async () => {
    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "api-not-available",
    });

    const onError = jest.fn();
    const { result } = renderHook(() => useScannerLifecycle(videoRef, { onError }));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("failure");
      expect(result.current.getError()?.code).toBe("permission-not-supported");
    });
  });
});

describe("useScannerLifecycle - Visibility Changes", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("pauses scanner when tab becomes hidden", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    // Simulate tab becoming hidden
    act(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("suspended");
    });
  });

  it("resumes scanner when tab becomes visible", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const { result } = renderHook(() => useScannerLifecycle(videoRef));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    // Pause
    act(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("suspended");
    });

    // Resume
    act(() => {
      Object.defineProperty(document, "hidden", {
        value: false,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });
  });

  it("calls onVisibilityChange callback", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const onVisibilityChange = jest.fn();
    const { result } = renderHook(() =>
      useScannerLifecycle(videoRef, { onVisibilityChange }),
    );

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    // Pause
    act(() => {
      Object.defineProperty(document, "hidden", {
        value: true,
        configurable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith(false);
    });
  });
});

describe("useScannerLifecycle - Device Changes", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("calls onDeviceDisconnect when stream ends unexpectedly", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);

    let streamEndedCallback: (() => void) | null = null;
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockImplementation(
      (_stream: unknown, callback: () => void) => {
        streamEndedCallback = callback;
        return () => {};
      },
    );

    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.detachStreamFromVideo as jest.Mock).mockReturnValue(undefined);
    (mediaStreamManager.stopMediaStream as jest.Mock).mockReturnValue(undefined);

    const onError = jest.fn();
    const { result } = renderHook(() =>
      useScannerLifecycle(videoRef, { onError }),
    );

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    // Simulate stream ending — this fires onError then stops the camera
    act(() => {
      streamEndedCallback?.();
    });

    // onError should be called with stream-stopped error
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code: "stream-stopped" }),
      );
    });
  });
});

describe("useScannerLifecycle - Cleanup on Unmount", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("calls detachStreamFromVideo on unmount", () => {
    const { unmount } = renderHook(() => useScannerLifecycle(videoRef));

    unmount();

    expect(mediaStreamManager.detachStreamFromVideo).toHaveBeenCalled();
  });

  it("calls stopMediaStream on unmount", () => {
    const { unmount } = renderHook(() => useScannerLifecycle(videoRef));

    unmount();

    expect(mediaStreamManager.stopMediaStream).toHaveBeenCalled();
  });
});

describe("useScannerLifecycle - Callbacks", () => {
  let videoRef: React.RefObject<HTMLVideoElement>;

  beforeEach(() => {
    jest.clearAllMocks();
    videoRef = applyDefaultMocks({ current: document.createElement("video") });
  });

  it("calls onCameraReady when camera starts successfully", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const onCameraReady = jest.fn();
    const { result } = renderHook(() => useScannerLifecycle(videoRef, { onCameraReady }));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(onCameraReady).toHaveBeenCalled();
    });
  });

  it("calls onCameraStopped when camera is stopped", async () => {
    const mockStream = {
      getTracks: () => [],
    };

    (mediaStreamManager.getMediaStream as jest.Mock).mockResolvedValue({
      ok: true,
      stream: mockStream,
    });

    (mediaStreamManager.attachStreamToVideo as jest.Mock).mockResolvedValue(true);
    (mediaStreamManager.monitorStreamHealth as jest.Mock).mockReturnValue(() => {});
    (mediaStreamManager.onDeviceChange as jest.Mock).mockReturnValue(() => {});

    const onCameraStopped = jest.fn();
    const { result } = renderHook(() => useScannerLifecycle(videoRef, { onCameraStopped }));

    act(() => {
      result.current.startCamera();
    });

    await waitFor(() => {
      expect(result.current.state.name).toBe("active");
    });

    act(() => {
      result.current.stopCamera();
    });

    expect(onCameraStopped).toHaveBeenCalled();
  });
});
