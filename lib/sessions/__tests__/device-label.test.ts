import { labelDevice } from "../device-label";

describe("labelDevice", () => {
  it("labels a macOS Chrome user agent", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    expect(labelDevice(ua)).toBe("macOS - Chrome");
  });

  it("labels a Windows Edge user agent", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0";
    expect(labelDevice(ua)).toBe("Windows - Edge");
  });

  it("labels an iOS Safari user agent", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
    expect(labelDevice(ua)).toBe("iOS - Safari");
  });

  it("labels an Android Chrome user agent", () => {
    const ua =
      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
    expect(labelDevice(ua)).toBe("Android - Chrome");
  });

  it("labels a Linux Firefox user agent", () => {
    const ua = "Mozilla/5.0 (X11; Linux x86_64; rv:120.0) Gecko/20100101 Firefox/120.0";
    expect(labelDevice(ua)).toBe("Linux - Firefox");
  });

  it("falls back to Unknown for an unrecognized user agent", () => {
    expect(labelDevice("some-custom-client/1.0")).toBe("Unknown device - Unknown browser");
  });

  it("falls back gracefully for an empty string", () => {
    expect(labelDevice("")).toBe("Unknown device - Unknown browser");
  });

  it("never includes the raw user agent string in its output (privacy-safe)", () => {
    const ua =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    const label = labelDevice(ua);
    expect(label).not.toContain("AppleWebKit");
    expect(label).not.toContain("537.36");
    expect(label.length).toBeLessThan(ua.length);
  });
});
