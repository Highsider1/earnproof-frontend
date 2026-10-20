"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { appConfig } from "@/config/app";
import {
  parseQrPayload,
  scanDiagnosticToLogLine,
  type QrRejectReason,
  type ScanDiagnostic,
} from "@/lib/validation/qr-payload";
import { useScannerLifecycle } from "@/lib/scanner/use-scanner-lifecycle";
import { type ScannerError } from "@/lib/scanner/scanner-state";

type BarcodeResult = { rawValue: string };
type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource | HTMLVideoElement) => Promise<BarcodeResult[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor;
  }
}

const REJECT_MESSAGES: Record<QrRejectReason, string> = {
  empty: "That QR code was empty. Try another code or enter a proof ID.",
  oversized: "That QR code is too large to process. Use a standard EarnProof verification code.",
  malformed: "That does not look like an EarnProof QR code. Try again or enter a proof ID.",
  "unsafe-scheme": "That QR code is not a trusted EarnProof verification link.",
  "origin-mismatch": "That QR code points outside EarnProof and was not opened.",
  "route-mismatch": "That QR code is not a trusted EarnProof verification link.",
  "invalid-proof-id": "That does not look like an EarnProof QR code. Try again or enter a proof ID.",
  "unsupported-version": "That QR code uses an unsupported EarnProof version.",
  "multiple-codes": "Multiple QR codes were found. Isolate a single EarnProof code and try again.",
};

function logScan(event: ScanDiagnostic) {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  console.debug("[qr-scan]", scanDiagnosticToLogLine(event));
}

/**
 * Map scanner lifecycle errors to user-facing messages.
 */
function getScannerErrorMessage(error: ScannerError): string {
  return error.userMessage;
}

export function VerifyScan() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const scanTimerRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const [manualInput, setManualInput] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [cameraAvailable, setCameraAvailable] = useState(true);
  const [statusAnnouncement, setStatusAnnouncement] = useState(
    "Camera is idle. You can allow the camera, upload an image, or enter a proof ID.",
  );

  // Initialize scanner lifecycle management
  const scanner = useScannerLifecycle(videoRef as React.RefObject<HTMLVideoElement>, {
    onCameraReady: () => {
      setStatusAnnouncement("Camera is scanning. Center one EarnProof QR code in the frame.");
    },
    onCameraStopped: () => {
      // Camera stopped
    },
    onError: (error: ScannerError) => {
      setMessage(getScannerErrorMessage(error));
      setStatusAnnouncement(getScannerErrorMessage(error));
      setCameraAvailable(error.recoverable);
      logScan({
        outcome: error.recoverable ? "camera-denied" : "camera-unavailable",
        reason: "detector-missing",
      });
    },
    onVisibilityChange: (visible: boolean) => {
      if (!visible) {
        setStatusAnnouncement("Camera is paused. Bring this tab to the foreground to resume scanning.");
      } else {
        setStatusAnnouncement("Camera is scanning. Center one EarnProof QR code in the frame.");
      }
    },
    onDeviceDisconnect: () => {
      setMessage("Camera device was disconnected. Try again.");
      setStatusAnnouncement("Camera device was disconnected. Try again.");
    },
  });

  const submitValue = useCallback(
    (value: string, extras?: { multiple?: boolean }) => {
      if (extras?.multiple) {
        setMessage(REJECT_MESSAGES["multiple-codes"]);
        setStatusAnnouncement(REJECT_MESSAGES["multiple-codes"]);
        logScan({ outcome: "multiple-codes", reason: "multiple-codes" });
        return false;
      }

      const parsed = parseQrPayload(value, appConfig.appUrl);
      if (!parsed.ok) {
        setMessage(REJECT_MESSAGES[parsed.reason]);
        setStatusAnnouncement(REJECT_MESSAGES[parsed.reason]);
        logScan({
          outcome: "rejected",
          reason: parsed.reason,
          payloadBytes: new TextEncoder().encode(value).length,
        });
        return false;
      }

      logScan({
        outcome: "accepted",
        format: parsed.format,
        payloadBytes: new TextEncoder().encode(value).length,
      });
      scanner.stopCamera();
      void router.push(parsed.verifyPath);
      return true;
    },
    [scanner, router],
  );

  const startCamera = useCallback(async () => {
    setMessage(null);
    setStatusAnnouncement("Requesting camera permission.");
    await scanner.startCamera();
  }, [scanner]);

  const stopCamera = useCallback(() => {
    scanner.stopCamera();
  }, [scanner]);

  /**
   * Begin scanning loop: detect QR codes from video stream.
   */
  useEffect(() => {
    if (scanner.state.name !== "active" || !videoRef.current) {
      return;
    }

    // Initialize detector if not already done
    if (!detectorRef.current && window.BarcodeDetector) {
      detectorRef.current = new window.BarcodeDetector({ formats: ["qr_code"] });
    }

    const detector = detectorRef.current;
    if (!detector) {
      return;
    }

    const video = videoRef.current;
    const scanFrame = async () => {
      if (!video || !scanner.state.isScanning) {
        return;
      }

      if (video.readyState < HTMLMediaElement.HAVE_ENOUGH_DATA) {
        scanTimerRef.current = window.setTimeout(() => void scanFrame(), 250);
        return;
      }

      try {
        const results = await detector.detect(video);
        if (results.length > 1) {
          scanner.stopCamera();
          submitValue(results[0]?.rawValue ?? "", { multiple: true });
          return;
        }
        const value = results[0]?.rawValue;
        if (value) {
          if (submitValue(value)) {
            return;
          }
          scanner.stopCamera();
          return;
        }
        scanTimerRef.current = window.setTimeout(() => void scanFrame(), 250);
      } catch {
        scanner.stopCamera();
        setMessage("We could not read that QR code. Center it in the frame and try again.");
        setStatusAnnouncement("Scanning failed. You can retry the camera, upload an image, or enter a proof ID.");
        logScan({ outcome: "unreadable", reason: "image-unreadable" });
      }
    };

    scanTimerRef.current = window.setTimeout(() => void scanFrame(), 150);

    return () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
    };
  }, [scanner.state.name, scanner.state.isScanning, submitValue]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  /**
   * Cleanup on unmount.
   */
  useEffect(() => {
    return () => {
      if (scanTimerRef.current !== null) {
        window.clearTimeout(scanTimerRef.current);
        scanTimerRef.current = null;
      }
      scanner.stopCamera();
    };
  }, []);

  async function onImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setMessage(null);
    if (!file) return;
    if (!window.BarcodeDetector) {
      setMessage("Image QR scanning is not available in this browser. Enter the proof ID manually.");
      setStatusAnnouncement("Image QR scanning is not available. Enter the proof ID manually.");
      logScan({ outcome: "camera-unavailable", reason: "detector-missing" });
      return;
    }

    try {
      setStatusAnnouncement("Reading the uploaded QR image.");
      const bitmap = await createImageBitmap(file);
      const results = await new window.BarcodeDetector({ formats: ["qr_code"] }).detect(bitmap);
      bitmap.close();
      if (results.length > 1) {
        submitValue(results[0]?.rawValue ?? "", { multiple: true });
        return;
      }
      if (!results[0]?.rawValue || !submitValue(results[0].rawValue)) {
        if (!results[0]?.rawValue) {
          setMessage("No readable EarnProof QR code was found in that image. Try another image.");
          setStatusAnnouncement("No readable EarnProof QR code was found. Try another image or enter a proof ID.");
          logScan({ outcome: "unreadable", reason: "image-unreadable" });
        }
      }
    } catch {
      setMessage("We could not read that image. Choose a clear QR code image and try again.");
      setStatusAnnouncement("The uploaded image could not be read. Try a clearer image or enter a proof ID.");
      logScan({ outcome: "unreadable", reason: "image-unreadable" });
    }
  }

  function onManualSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    submitValue(manualInput);
  }

  const isScanning = scanner.state.isScanning;

  return (
    <section
      className="relative min-h-[248px] overflow-hidden rounded-lg border border-white/10 bg-slate-900 p-3 sm:min-h-[514px] sm:p-8"
      aria-labelledby="camera-title"
    >
      <div aria-live="polite" className="sr-only" role="status">
        {statusAnnouncement}
      </div>
      <video
        ref={videoRef}
        aria-label="QR code camera preview"
        className={`absolute inset-0 h-full w-full object-cover ${isScanning ? "" : "hidden"}`}
        muted
        playsInline
      />
      {isScanning ? (
        <div className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-cyan-200/80" aria-hidden="true" />
      ) : null}

      <div className={`relative z-10 max-w-sm ${isScanning ? "rounded-lg bg-slate-950/80 p-4 backdrop-blur-sm" : ""}`}>
        {!isScanning ? <div className="h-12 w-12 rounded-full border border-cyan-300/60 bg-cyan-300/10 sm:h-[86px] sm:w-[86px]" aria-hidden="true" /> : null}
        <h2 className={`${isScanning ? "" : "mt-3 sm:mt-5"} text-base font-semibold leading-6 text-white sm:text-4xl sm:leading-10`} id="camera-title">
          Scan proof QR
        </h2>
        <p className="mt-2 text-xs leading-5 text-slate-300 sm:text-sm sm:leading-6">
          Use your camera to open a verification link securely.
        </p>

        {message ? <p className="mt-3 text-xs leading-5 text-rose-200" role="alert">{message}</p> : null}

        <div className="mt-3 grid w-fit gap-2 sm:mt-5">
          <button
            className="h-8 rounded-md bg-cyan-300 px-5 text-xs font-medium text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:h-10 sm:px-7 sm:text-sm"
            disabled={!cameraAvailable || scanner.state.isStarting || isScanning}
            onClick={() => void startCamera()}
            type="button"
          >
            {scanner.state.isStarting ? "Starting camera..." : "Allow camera"}
          </button>
          {isScanning ? (
            <button
              className="h-8 rounded-md border border-white/20 px-5 text-xs font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:h-10 sm:text-sm"
              onClick={stopCamera}
              type="button"
            >
              Stop camera
            </button>
          ) : null}
        </div>

        {!isScanning ? (
          <div className="mt-4 grid gap-3 rounded-lg border border-white/10 bg-slate-950/40 p-3 sm:w-[360px] sm:p-4">
            <form className="grid gap-2" onSubmit={onManualSubmit}>
              <label className="text-xs font-medium text-slate-300" htmlFor="manual-proof">
                Proof ID or verification URL
              </label>
              <input
                autoComplete="off"
                className="h-10 rounded-md border border-white/15 bg-transparent px-3 text-xs text-white placeholder:text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:text-sm"
                id="manual-proof"
                onChange={(event) => setManualInput(event.target.value)}
                placeholder="ep_7F3A or verification link"
                value={manualInput}
              />
              <button
                className="h-9 rounded-md bg-cyan-300 px-4 text-xs font-medium text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 sm:text-sm"
                type="submit"
              >
                Verify proof
              </button>
            </form>
            <label
              className="flex h-9 cursor-pointer items-center justify-center rounded-md border border-white/15 px-4 text-xs font-medium text-white hover:border-white/30 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-cyan-300 sm:text-sm"
              htmlFor="qr-image"
            >
              Upload QR image
              <input accept="image/*" className="sr-only" id="qr-image" onChange={onImageChange} type="file" />
            </label>
          </div>
        ) : null}
      </div>
    </section>
  );
}
