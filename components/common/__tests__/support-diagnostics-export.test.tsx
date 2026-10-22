/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SupportDiagnosticsExport } from "../support-diagnostics-export";

jest.mock("next/navigation", () => ({
  usePathname: () => "/faq",
}));

describe("SupportDiagnosticsExport", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn().mockRejectedValue(new Error("no network in tests"));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("generates and previews a bundle before export", async () => {
    render(<SupportDiagnosticsExport />);

    fireEvent.click(screen.getByRole("button", { name: /export support diagnostics/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Route");
    expect(dialog).toHaveTextContent("/faq");
    expect(dialog).toHaveTextContent("Request ID");
  });

  it("cancel closes the preview without exporting anything", async () => {
    render(<SupportDiagnosticsExport />);
    fireEvent.click(screen.getByRole("button", { name: /export support diagnostics/i }));
    await screen.findByRole("dialog");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("generation works even when the API/health check fails", async () => {
    render(<SupportDiagnosticsExport />);
    fireEvent.click(screen.getByRole("button", { name: /export support diagnostics/i }));

    const dialog = await screen.findByRole("dialog");
    expect(dialog).toBeInTheDocument();
  });

  it("unchecking an optional field updates the preview to omit it", async () => {
    render(<SupportDiagnosticsExport />);
    fireEvent.click(screen.getByRole("button", { name: /export support diagnostics/i }));
    await screen.findByRole("dialog");

    const featuresCheckbox = screen.getByRole("checkbox", { name: /browser feature support/i });
    expect(featuresCheckbox).toBeChecked();

    fireEvent.click(featuresCheckbox);

    await waitFor(() => {
      const pre = screen.getByText(/"barcodeDetector"/i, { selector: "pre" });
      const parsed = JSON.parse(pre.textContent ?? "{}");
      expect(parsed.features).toEqual({
        clipboard: false,
        camera: false,
        barcodeDetector: false,
        sendBeacon: false,
      });
    });
  });
});
