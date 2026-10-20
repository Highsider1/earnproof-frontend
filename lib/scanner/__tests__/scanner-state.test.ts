/**
 * @jest-environment jsdom
 */

import {
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
  createDetectorError,
  createDeviceDisconnectError,
  createStreamStoppedError,
  createUnknownError,
} from "../scanner-state";

describe("ScannerState - Happy Path Transitions", () => {
  it("transitions from permission to startup when user allows camera", () => {
    expect(isValidStateTransition("permission", "startup")).toBe(true);
    const state = createStartupState();
    expect(state.name).toBe("startup");
    expect(state.isStarting).toBe(true);
    expect(state.isScanning).toBe(false);
  });

  it("transitions from startup to active when stream acquired", () => {
    expect(isValidStateTransition("startup", "active")).toBe(true);
    const state = createActiveState();
    expect(state.name).toBe("active");
    expect(state.isStarting).toBe(false);
    expect(state.isScanning).toBe(true);
    expect(state.hasActiveStream).toBe(true);
  });

  it("transitions from active to suspended when tab hidden", () => {
    expect(isValidStateTransition("active", "suspended")).toBe(true);
    const state = createSuspendedState();
    expect(state.name).toBe("suspended");
    expect(state.isScanning).toBe(false);
    expect(state.hasActiveStream).toBe(true);
  });

  it("transitions from suspended back to active when tab visible", () => {
    expect(isValidStateTransition("suspended", "active")).toBe(true);
    const state = createActiveState();
    expect(state.name).toBe("active");
    expect(state.isScanning).toBe(true);
  });

  it("transitions from active to stopped when user cancels", () => {
    expect(isValidStateTransition("active", "stopped")).toBe(true);
    const state = createStoppedState();
    expect(state.name).toBe("stopped");
    expect(state.isScanning).toBe(false);
    expect(state.hasActiveStream).toBe(false);
  });

  it("completes full successful scan cycle: permission → startup → active → stopped", () => {
    expect(isValidStateTransition("permission", "startup")).toBe(true);
    expect(isValidStateTransition("startup", "active")).toBe(true);
    expect(isValidStateTransition("active", "stopped")).toBe(true);
  });

  it("completes full pause/resume cycle: active → suspended → active", () => {
    expect(isValidStateTransition("active", "suspended")).toBe(true);
    expect(isValidStateTransition("suspended", "active")).toBe(true);
  });
});

describe("ScannerState - Edge Cases", () => {
  it("allows multiple pause/resume cycles", () => {
    expect(isValidStateTransition("active", "suspended")).toBe(true);
    expect(isValidStateTransition("suspended", "active")).toBe(true);
    expect(isValidStateTransition("active", "suspended")).toBe(true);
    expect(isValidStateTransition("suspended", "active")).toBe(true);
  });

  it("transitions from startup to failure on permission denied", () => {
    expect(isValidStateTransition("startup", "failure")).toBe(true);
    const error = createPermissionDeniedError();
    const state = createFailureState(error);
    expect(state.name).toBe("failure");
    expect(state.error).toBe(error);
    expect(state.error?.recoverable).toBe(true);
  });

  it("transitions from active to failure on scanner error", () => {
    expect(isValidStateTransition("active", "failure")).toBe(true);
    const error = createDetectorError(new Error("test"));
    const state = createFailureState(error);
    expect(state.name).toBe("failure");
    expect(state.error?.recoverable).toBe(true);
  });

  it("transitions from suspended to failure on device disconnect", () => {
    expect(isValidStateTransition("suspended", "failure")).toBe(true);
    const error = createDeviceDisconnectError();
    const state = createFailureState(error);
    expect(state.name).toBe("failure");
  });

  it("allows recovery from failure back to permission state", () => {
    expect(isValidStateTransition("failure", "permission")).toBe(true);
  });

  it("allows retry directly from failure to startup", () => {
    expect(isValidStateTransition("failure", "startup")).toBe(true);
  });

  it("allows cleanup from failure to stopped", () => {
    expect(isValidStateTransition("failure", "stopped")).toBe(true);
  });

  it("can transition from any state to stopped (cleanup invariant)", () => {
    const states: ScannerStateName[] = ["permission", "startup", "active", "suspended", "failure"];
    states.forEach((state) => {
      expect(isValidStateTransition(state, "stopped")).toBe(true);
    });
  });
});

describe("ScannerState - Invalid Transitions", () => {
  it("rejects direct transition from permission to active", () => {
    expect(isValidStateTransition("permission", "active")).toBe(false);
  });

  it("rejects direct transition from startup to suspended", () => {
    expect(isValidStateTransition("startup", "suspended")).toBe(false);
  });

  it("rejects backward transition from active to startup", () => {
    expect(isValidStateTransition("active", "startup")).toBe(false);
  });

  it("rejects transition from suspended to startup", () => {
    expect(isValidStateTransition("suspended", "startup")).toBe(false);
  });

  it("rejects transition from stopped to any other state", () => {
    const targets: ScannerStateName[] = [
      "permission",
      "startup",
      "active",
      "suspended",
      "failure",
    ];
    targets.forEach((target) => {
      expect(isValidStateTransition("stopped", target)).toBe(false);
    });
  });

  it("rejects invalid state pairs", () => {
    expect(isValidStateTransition("permission", "permission")).toBe(false);
    expect(isValidStateTransition("active", "active")).toBe(false);
  });
});

describe("ScannerState - Error Factories", () => {
  it("creates permission denied error with recovery flag", () => {
    const error = createPermissionDeniedError();
    expect(error.code).toBe("permission-denied");
    expect(error.recoverable).toBe(true);
    expect(error.userMessage).toContain("Camera access was denied or unavailable");
  });

  it("creates permission not supported error without recovery flag", () => {
    const error = createPermissionNotSupportedError();
    expect(error.code).toBe("permission-not-supported");
    expect(error.recoverable).toBe(false);
  });

  it("creates camera not available error without recovery flag", () => {
    const error = createCameraNotAvailableError();
    expect(error.code).toBe("camera-not-available");
    expect(error.recoverable).toBe(false);
  });

  it("creates detector not available error without recovery flag", () => {
    const error = createDetectorNotAvailableError();
    expect(error.code).toBe("detector-not-available");
    expect(error.recoverable).toBe(false);
  });

  it("creates detector error with recovery flag", () => {
    const cause = new Error("QR detection failed");
    const error = createDetectorError(cause);
    expect(error.code).toBe("detector-error");
    expect(error.recoverable).toBe(true);
    expect(error.message).toContain("QR detection failed");
  });

  it("creates device disconnect error with recovery flag", () => {
    const error = createDeviceDisconnectError();
    expect(error.code).toBe("device-disconnect");
    expect(error.recoverable).toBe(true);
  });

  it("creates stream stopped error with recovery flag", () => {
    const error = createStreamStoppedError();
    expect(error.code).toBe("stream-stopped");
    expect(error.recoverable).toBe(true);
  });

  it("creates unknown error with recovery flag", () => {
    const cause = "unknown cause";
    const error = createUnknownError(cause);
    expect(error.code).toBe("unknown");
    expect(error.recoverable).toBe(true);
  });

  it("handles Error objects in createUnknownError", () => {
    const error = createUnknownError(new Error("test error"));
    expect(error.message).toContain("test error");
  });

  it("handles non-Error objects in createUnknownError", () => {
    const error = createUnknownError("plain string error");
    expect(error.message).toContain("plain string error");
  });
});

describe("ScannerState - State Properties", () => {
  it("permission state has correct properties", () => {
    expect(SCANNER_STATE_PERMISSION.name).toBe("permission");
    expect(SCANNER_STATE_PERMISSION.isStarting).toBe(false);
    expect(SCANNER_STATE_PERMISSION.isScanning).toBe(false);
    expect(SCANNER_STATE_PERMISSION.hasActiveStream).toBe(false);
  });

  it("startup state has correct properties", () => {
    const state = createStartupState();
    expect(state.isStarting).toBe(true);
    expect(state.isScanning).toBe(false);
    expect(state.hasActiveStream).toBe(false);
  });

  it("active state has correct properties", () => {
    const state = createActiveState();
    expect(state.isStarting).toBe(false);
    expect(state.isScanning).toBe(true);
    expect(state.hasActiveStream).toBe(true);
  });

  it("suspended state has correct properties", () => {
    const state = createSuspendedState();
    expect(state.isStarting).toBe(false);
    expect(state.isScanning).toBe(false);
    expect(state.hasActiveStream).toBe(true);
  });

  it("failure state includes error details", () => {
    const error = createPermissionDeniedError();
    const state = createFailureState(error);
    expect(state.error).toBe(error);
    expect(state.statusMessage).toBe(error.userMessage);
  });

  it("stopped state has correct properties", () => {
    const state = createStoppedState();
    expect(state.name).toBe("stopped");
    expect(state.isStarting).toBe(false);
    expect(state.isScanning).toBe(false);
    expect(state.hasActiveStream).toBe(false);
  });

  it("all states have status messages", () => {
    const states = [
      SCANNER_STATE_PERMISSION,
      createStartupState(),
      createActiveState(),
      createSuspendedState(),
      createFailureState(createPermissionDeniedError()),
      createStoppedState(),
    ];

    states.forEach((state) => {
      expect(typeof state.statusMessage).toBe("string");
      expect(state.statusMessage.length).toBeGreaterThan(0);
    });
  });
});
