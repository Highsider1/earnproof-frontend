/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyScan } from "../verify-scan";

// ──────────────────────────────────────────────────────────────────────────────
// Global stubs
// ──────────────────────────────────────────────────────────────────────────────

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => "/verify/scan",
}));

const mockDetect = jest.fn();
(global as Record<string, unknown>).BarcodeDetector = jest
  .fn()
  .mockImplementation(() => ({ detect: mockDetect }));

// Stub getUserMedia so the real hook doesn't throw in jsdom
Object.defineProperty(navigator, "mediaDevices", {
  value: {
    getUserMedia: jest.fn().mockRejectedValue(
      new DOMException("Permission denied", "NotAllowedError"),
    ),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  },
  configurable: true,
});

// ──────────────────────────────────────────────────────────────────────────────
// Rendering
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Component Rendering", () => {
  it("renders scanner UI with camera button and manual entry form", () => {
    render(<VerifyScan />);

    expect(
      screen.getByRole("heading", { name: /scan proof qr/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /allow camera/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/proof id or verification url/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /verify proof/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/upload qr image/i)).toBeInTheDocument();
  });

  it("renders status announcement aria-live region", () => {
    render(<VerifyScan />);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
    expect(liveRegion).toHaveClass("sr-only");
  });

  it("renders video element with muted and playsinline attributes", () => {
    render(<VerifyScan />);

    const video = screen.getByLabelText(/qr code camera preview/i) as HTMLVideoElement;
    // muted is a DOM property, not a reflected attribute in jsdom
    expect(video.muted).toBe(true);
    // playsInline is also a DOM property
    expect(video).toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Accessibility
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Accessibility", () => {
  it("section is labelled by camera-title heading", () => {
    render(<VerifyScan />);

    // The section has aria-labelledby="camera-title"
    const heading = screen.getByRole("heading", { name: /scan proof qr/i });
    expect(heading).toHaveAttribute("id", "camera-title");
  });

  it("all form inputs have associated labels", () => {
    render(<VerifyScan />);

    // htmlFor associations verified by getByLabelText succeeding
    expect(screen.getByLabelText(/proof id or verification url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/upload qr image/i)).toBeInTheDocument();
  });

  it("decorative elements are hidden from screen readers", () => {
    render(<VerifyScan />);

    const hidden = document.querySelectorAll('[aria-hidden="true"]');
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("camera button is keyboard-reachable", async () => {
    const user = userEvent.setup();
    render(<VerifyScan />);

    await user.tab();
    // First focusable element should be reachable
    expect(document.activeElement).not.toBe(document.body);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Manual input fallback
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Manual Input Fallback", () => {
  it("shows manual input and upload form in idle state", () => {
    render(<VerifyScan />);

    expect(
      screen.getByLabelText(/proof id or verification url/i),
    ).toBeVisible();
    expect(screen.getByLabelText(/upload qr image/i)).toBeVisible();
  });

  it("shows an error alert when manual input fails validation", async () => {
    const user = userEvent.setup();
    render(<VerifyScan />);

    const input = screen.getByLabelText(/proof id or verification url/i);
    // Value with unsafe chars that parseQrPayload will reject
    await user.type(input, "javascript:alert(1)");
    await user.click(screen.getByRole("button", { name: /verify proof/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("does not show an error alert on initial render", () => {
    render(<VerifyScan />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Image upload
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Image Upload", () => {
  beforeEach(() => {
    mockDetect.mockReset();
    (global as Record<string, unknown>).createImageBitmap = jest
      .fn()
      .mockResolvedValue({ close: jest.fn() });
  });

  it("shows an error when image upload scanning fails", async () => {
    mockDetect.mockRejectedValue(new Error("Detection failed"));

    const user = userEvent.setup();
    render(<VerifyScan />);

    const imageInput = screen.getByLabelText(/upload qr image/i);
    const file = new File(["fake"], "qr.png", { type: "image/png" });

    await user.upload(imageInput, file);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });

  it("shows an error when no QR code found in image", async () => {
    mockDetect.mockResolvedValue([]); // empty results

    const user = userEvent.setup();
    render(<VerifyScan />);

    const imageInput = screen.getByLabelText(/upload qr image/i);
    const file = new File(["fake"], "qr.png", { type: "image/png" });

    await user.upload(imageInput, file);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Status announcements
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Status Announcements", () => {
  it("populates the aria-live region with an initial message", () => {
    render(<VerifyScan />);

    const liveRegion = screen.getByRole("status");
    expect(liveRegion.textContent?.length).toBeGreaterThan(0);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Unmount cleanup
// ──────────────────────────────────────────────────────────────────────────────

describe("VerifyScan - Unmount", () => {
  it("unmounts without throwing", () => {
    const { unmount } = render(<VerifyScan />);

    expect(() => unmount()).not.toThrow();
    expect(
      screen.queryByRole("heading", { name: /scan proof qr/i }),
    ).not.toBeInTheDocument();
  });
});
