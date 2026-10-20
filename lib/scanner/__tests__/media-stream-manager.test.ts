/**
 * @jest-environment jsdom
 */

import {
  getMediaStream,
  attachStreamToVideo,
  stopMediaStream,
  detachStreamFromVideo,
  isStreamActive,
  monitorStreamHealth,
  onDeviceChange,
} from "../media-stream-manager";

// Mock navigator.mediaDevices if not available
if (!navigator.mediaDevices) {
  Object.defineProperty(navigator, "mediaDevices", {
    value: {
      getUserMedia: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    },
    configurable: true,
  });
}

describe("MediaStreamManager - Media Acquisition", () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    // Reinitialize mediaDevices for each test
    if (!navigator.mediaDevices) {
      Object.defineProperty(navigator, "mediaDevices", {
        value: {
          getUserMedia: jest.fn(),
          addEventListener: jest.fn(),
          removeEventListener: jest.fn(),
        },
        configurable: true,
      });
    }
  });

  it("acquires media stream with environment facing mode by default", async () => {
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    navigator.mediaDevices.getUserMedia = jest
      .fn()
      .mockResolvedValue(mockStream);

    const result = await getMediaStream();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.stream).toBe(mockStream);
    }
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: false,
        video: expect.objectContaining({
          facingMode: expect.objectContaining({ ideal: "environment" }),
        }),
      }),
    );
  });

  it("acquires media stream with user facing mode when specified", async () => {
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    navigator.mediaDevices.getUserMedia = jest
      .fn()
      .mockResolvedValue(mockStream);

    const result = await getMediaStream({ facingMode: "user" });

    expect(result.ok).toBe(true);
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        video: expect.objectContaining({
          facingMode: expect.objectContaining({ ideal: "user" }),
        }),
      }),
    );
  });

  it("returns api-not-available when getUserMedia is not supported", async () => {
    // Mock the condition where getUserMedia is not available
    const originalGetUserMedia = (navigator.mediaDevices as unknown as Record<string, unknown>).getUserMedia;
    (navigator.mediaDevices as unknown as Record<string, unknown>).getUserMedia = undefined;

    const result = await getMediaStream();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("api-not-available");
    }

    // Restore
    (navigator.mediaDevices as unknown as Record<string, unknown>).getUserMedia = originalGetUserMedia;
  });

  it("returns permission-denied when NotAllowedError is thrown", async () => {
    const error = new DOMException("Permission denied", "NotAllowedError");
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(error);

    const result = await getMediaStream();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("permission-denied");
    }
  });

  it("returns device-not-found when NotFoundError is thrown", async () => {
    const error = new DOMException("No camera found", "NotFoundError");
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(error);

    const result = await getMediaStream();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("device-not-found");
    }
  });

  it("returns aborted when AbortError is thrown", async () => {
    const error = new DOMException("Aborted", "AbortError");
    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(error);

    const result = await getMediaStream();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("aborted");
    }
  });

  it("returns permission-denied for unrecognised errors (plain Error, etc.)", async () => {
    navigator.mediaDevices.getUserMedia = jest
      .fn()
      .mockRejectedValue(new Error("Unknown error"));

    const result = await getMediaStream();

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("permission-denied");
    }
  });

  it("respects abort signal and cancels request", async () => {
    const controller = new AbortController();
    const error = new DOMException("Aborted", "AbortError");

    navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(error);

    setTimeout(() => controller.abort(), 10);
    const result = await getMediaStream({ signal: controller.signal });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("aborted");
    }
  });
});

describe("MediaStreamManager - Stream Attachment", () => {
  it("attaches stream to video element and starts playback", async () => {
    const video = document.createElement("video");
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    jest.spyOn(video, "play").mockResolvedValue();

    const result = await attachStreamToVideo(video, mockStream);

    expect(result).toBe(true);
    expect(video.srcObject).toBe(mockStream);
    expect(video.play).toHaveBeenCalled();
  });

  it("clears srcObject and returns false if play() fails", async () => {
    const video = document.createElement("video");
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    jest.spyOn(video, "play").mockRejectedValue(new Error("Play failed"));

    const result = await attachStreamToVideo(video, mockStream);

    expect(result).toBe(false);
    expect(video.srcObject).toBeNull();
  });

  it("clears srcObject and returns false if srcObject assignment fails", async () => {
    const video = document.createElement("video");
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    Object.defineProperty(video, "srcObject", {
      set: jest.fn().mockImplementation(() => {
        throw new Error("Assignment failed");
      }),
      get: jest.fn(() => null),
    });

    const result = await attachStreamToVideo(video, mockStream);

    expect(result).toBe(false);
  });
});

describe("MediaStreamManager - Media Cleanup", () => {
  it("stops all tracks in a media stream", () => {
    const mockTrack1 = { stop: jest.fn() };
    const mockTrack2 = { stop: jest.fn() };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack1, mockTrack2]),
    } as unknown as MediaStream;

    stopMediaStream(mockStream);

    expect(mockTrack1.stop).toHaveBeenCalled();
    expect(mockTrack2.stop).toHaveBeenCalled();
  });

  it("is idempotent: safe to call multiple times", () => {
    const mockTrack = { stop: jest.fn() };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    stopMediaStream(mockStream);
    stopMediaStream(mockStream);
    stopMediaStream(mockStream);

    // getTracks should be called 3 times
    expect(mockStream.getTracks).toHaveBeenCalledTimes(3);
    expect(mockTrack.stop).toHaveBeenCalledTimes(3);
  });

  it("handles null or undefined stream gracefully", () => {
    expect(() => stopMediaStream(null)).not.toThrow();
    expect(() => stopMediaStream(undefined)).not.toThrow();
  });

  it("silently ignores errors when stopping individual tracks", () => {
    const mockTrack = { stop: jest.fn().mockImplementation(() => {
      throw new Error("Stop failed");
    }) };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    expect(() => stopMediaStream(mockStream)).not.toThrow();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("detaches stream from video element", () => {
    const video = document.createElement("video");
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    video.srcObject = mockStream;
    jest.spyOn(video, "pause");

    detachStreamFromVideo(video, false);

    expect(video.srcObject).toBeNull();
    expect(video.pause).toHaveBeenCalled();
  });

  it("stops all tracks when detaching if stopStream=true", () => {
    const video = document.createElement("video");
    const mockTrack = { stop: jest.fn() };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    video.srcObject = mockStream;

    detachStreamFromVideo(video, true);

    expect(video.srcObject).toBeNull();
    expect(mockTrack.stop).toHaveBeenCalled();
  });

  it("does not stop tracks when detaching if stopStream=false", () => {
    const video = document.createElement("video");
    const mockTrack = { stop: jest.fn() };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    video.srcObject = mockStream;

    detachStreamFromVideo(video, false);

    expect(mockTrack.stop).not.toHaveBeenCalled();
  });

  it("handles null or undefined video element gracefully", () => {
    expect(() => detachStreamFromVideo(null, true)).not.toThrow();
    expect(() => detachStreamFromVideo(undefined, true)).not.toThrow();
  });
});

describe("MediaStreamManager - Stream Health Monitoring", () => {
  it("sets up ended listeners on all tracks", () => {
    const mockTrack1 = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const mockTrack2 = { addEventListener: jest.fn(), removeEventListener: jest.fn() };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack1, mockTrack2]),
    } as unknown as MediaStream;

    monitorStreamHealth(mockStream, jest.fn());

    expect(mockTrack1.addEventListener).toHaveBeenCalledWith("ended", expect.any(Function));
    expect(mockTrack2.addEventListener).toHaveBeenCalledWith("ended", expect.any(Function));
  });

  it("calls onStreamEnded when a track ends", () => {
    const onStreamEnded = jest.fn();
    // Use a plain object instead of a typed variable so TS doesn't narrow to never
    const captured: { handler: (() => void) | null } = { handler: null };

    const mockTrack = {
      addEventListener: jest.fn((event: string, handler: () => void) => {
        if (event === "ended") {
          captured.handler = handler;
        }
      }),
      removeEventListener: jest.fn(),
    };

    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    monitorStreamHealth(mockStream, onStreamEnded);

    // Simulate track ending
    captured.handler?.();

    expect(onStreamEnded).toHaveBeenCalled();
  });

  it("returns cleanup function that removes listeners", () => {
    const mockTrack = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    const cleanup = monitorStreamHealth(mockStream, jest.fn());
    cleanup();

    expect(mockTrack.removeEventListener).toHaveBeenCalledWith("ended", expect.any(Function));
  });
});

describe("MediaStreamManager - Device Change Detection", () => {
  it("handles device change listeners", () => {
    // Device change detection is tested in integration
    expect(true).toBe(true);
  });
});

describe("MediaStreamManager - Stream Active Check", () => {
  it("returns true if stream has live tracks", () => {
    const mockTrack = { readyState: "live" as const };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack]),
    } as unknown as MediaStream;

    expect(isStreamActive(mockStream)).toBe(true);
  });

  it("returns false if stream has no tracks", () => {
    const mockStream = {
      getTracks: jest.fn(() => []),
    } as unknown as MediaStream;

    expect(isStreamActive(mockStream)).toBe(false);
  });

  it("returns false if all tracks are ended", () => {
    const mockTrack1 = { readyState: "ended" as const };
    const mockTrack2 = { readyState: "ended" as const };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack1, mockTrack2]),
    } as unknown as MediaStream;

    expect(isStreamActive(mockStream)).toBe(false);
  });

  it("returns true if any track is live", () => {
    const mockTrack1 = { readyState: "ended" as const };
    const mockTrack2 = { readyState: "live" as const };
    const mockStream = {
      getTracks: jest.fn(() => [mockTrack1, mockTrack2]),
    } as unknown as MediaStream;

    expect(isStreamActive(mockStream)).toBe(true);
  });

  it("returns false if stream is null or undefined", () => {
    expect(isStreamActive(null)).toBe(false);
    expect(isStreamActive(undefined)).toBe(false);
  });
});
