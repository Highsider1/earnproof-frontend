/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VerifyScan } from "@/components/verification/verify-scan";
import imageStates from "@/tests/fixtures/qr/image-states.json";
import malicious from "@/tests/fixtures/qr/malicious.json";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

jest.mock("@/config/app", () => ({
  appConfig: {
    appUrl: "https://app.earnproof.example",
  },
}));

type DetectFn = (source: unknown) => Promise<Array<{ rawValue: string }>>;

function mockDetector(detect: DetectFn) {
  Object.defineProperty(window, "BarcodeDetector", {
    configurable: true,
    writable: true,
    value: class {
      detect = detect;
    },
  });
}

describe("VerifyScan safety and recovery", () => {
  const originalCreateImageBitmap = global.createImageBitmap;
  const originalMediaDevices = navigator.mediaDevices;

  beforeEach(() => {
    push.mockReset();
    mockDetector(async () => []);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: jest.fn(),
      },
    });
    global.createImageBitmap = jest.fn().mockResolvedValue({ close: jest.fn() }) as typeof createImageBitmap;
  });

  afterEach(() => {
    global.createImageBitmap = originalCreateImageBitmap;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });

  it("keeps image upload and proof ID entry accessible when the camera is unavailable", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: undefined,
    });

    render(<VerifyScan />);
    await userEvent.click(screen.getByRole("button", { name: "Allow camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Camera scanning is not available/,
    );
    expect(screen.getByLabelText("Proof ID or verification URL")).toBeEnabled();
    expect(screen.getByLabelText("Upload QR image")).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("recovers from camera permission denial without trapping the user", async () => {
    (navigator.mediaDevices.getUserMedia as jest.Mock).mockRejectedValue(new Error("denied"));

    render(<VerifyScan />);
    await userEvent.click(screen.getByRole("button", { name: "Allow camera" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /Camera access was denied or unavailable/,
    );
    expect(screen.getByRole("button", { name: "Allow camera" })).toBeEnabled();
    expect(screen.getByLabelText("Proof ID or verification URL")).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects malicious scanned URLs without navigating or rendering the payload", async () => {
    const fixture = malicious.cases[0];
    render(<VerifyScan />);

    await userEvent.type(screen.getByLabelText("Proof ID or verification URL"), fixture.raw);
    await userEvent.click(screen.getByRole("button", { name: "Verify proof" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That QR code is not a trusted EarnProof verification link.",
    );
    expect(screen.queryByText(fixture.raw)).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("rejects oversized payloads", async () => {
    const oversized = `${imageStates.oversized.rawPrefix}${"A".repeat(600)}`;
    render(<VerifyScan />);
    await userEvent.click(screen.getByLabelText("Proof ID or verification URL"));
    await userEvent.paste(oversized);
    await userEvent.click(screen.getByRole("button", { name: "Verify proof" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("too large");
    expect(push).not.toHaveBeenCalled();
  });

  it("treats multiple detected codes as recoverable and does not navigate", async () => {
    mockDetector(async () => imageStates.multiple.codes.map((rawValue) => ({ rawValue })));
    render(<VerifyScan />);

    const file = new File(["qr"], "codes.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Upload QR image"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent("Multiple QR codes were found");
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Proof ID or verification URL")).toBeEnabled();
  });

  it("recovers from a blurred unreadable image upload", async () => {
    mockDetector(async () => imageStates.blurred.codes.map((rawValue) => ({ rawValue })));
    render(<VerifyScan />);

    const file = new File(["blur"], "blurred.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Upload QR image"), file);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /No readable EarnProof QR code/,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("navigates only to the internal verify path for a rotated-but-valid code", async () => {
    mockDetector(async () => imageStates.rotated.codes.map((rawValue) => ({ rawValue })));
    render(<VerifyScan />);

    const file = new File(["qr"], "rotated.png", { type: "image/png" });
    await userEvent.upload(screen.getByLabelText("Upload QR image"), file);

    await waitFor(() => {
      expect(push).toHaveBeenCalledWith("/verify?proof=EP-8A42-91DC");
    });
  });
});
