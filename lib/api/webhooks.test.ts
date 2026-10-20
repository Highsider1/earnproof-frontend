import {
  formatWebhookUrl,
  formatDeliveryTimestamp,
  getDeliveryStatusBadgeColor,
  getDeliveryStatusLabel,
} from "./webhooks";

describe("Webhook API Helpers", () => {
  describe("formatWebhookUrl", () => {
    it("extracts hostname from full URL", () => {
      const result = formatWebhookUrl("https://example.com/webhooks/earnproof");
      expect(result).toBe("example.com");
    });

    it("handles URLs with ports", () => {
      const result = formatWebhookUrl("https://api.example.com:8080/webhooks");
      expect(result).toBe("api.example.com");
    });

    it("handles URLs with subdomains", () => {
      const result = formatWebhookUrl("https://webhook.api.example.com/webhooks");
      expect(result).toBe("webhook.api.example.com");
    });

    it("returns original URL if parsing fails", () => {
      const result = formatWebhookUrl("not a valid url");
      expect(result).toBe("not a valid url");
    });

    it("handles localhost", () => {
      const result = formatWebhookUrl("https://localhost:3000/webhooks");
      expect(result).toBe("localhost");
    });

    it("handles IP addresses", () => {
      const result = formatWebhookUrl("https://192.0.2.1/webhooks");
      expect(result).toBe("192.0.2.1");
    });
  });

  describe("formatDeliveryTimestamp", () => {
    it("formats ISO timestamp to locale string", () => {
      const timestamp = "2024-01-15T10:30:00Z";
      const result = formatDeliveryTimestamp(timestamp);
      expect(result).toBeTruthy();
      expect(result).not.toBe(timestamp);
      // Should be a readable date format
      expect(result.length).toBeGreaterThan(10);
    });

    it("handles different ISO formats", () => {
      const timestamp = "2024-01-15T10:30:00.000Z";
      const result = formatDeliveryTimestamp(timestamp);
      expect(result).toBeTruthy();
    });

    it("returns original string if parsing fails", () => {
      const timestamp = "not a valid date";
      const result = formatDeliveryTimestamp(timestamp);
      expect(result).toBe(timestamp);
    });
  });

  describe("getDeliveryStatusBadgeColor", () => {
    it("returns green for SUCCESS", () => {
      expect(getDeliveryStatusBadgeColor("SUCCESS")).toBe("green");
    });

    it("returns red for FAILED", () => {
      expect(getDeliveryStatusBadgeColor("FAILED")).toBe("red");
    });

    it("returns yellow for RETRYING", () => {
      expect(getDeliveryStatusBadgeColor("RETRYING")).toBe("yellow");
    });

    it("returns blue for PENDING", () => {
      expect(getDeliveryStatusBadgeColor("PENDING")).toBe("blue");
    });

    it("returns gray for unknown status", () => {
      expect(getDeliveryStatusBadgeColor("UNKNOWN")).toBe("gray");
    });

    it("is case-sensitive", () => {
      expect(getDeliveryStatusBadgeColor("success")).toBe("gray");
    });
  });

  describe("getDeliveryStatusLabel", () => {
    it("returns Delivered for SUCCESS", () => {
      expect(getDeliveryStatusLabel("SUCCESS")).toBe("Delivered");
    });

    it("returns Failed for FAILED", () => {
      expect(getDeliveryStatusLabel("FAILED")).toBe("Failed");
    });

    it("returns Retrying for RETRYING", () => {
      expect(getDeliveryStatusLabel("RETRYING")).toBe("Retrying");
    });

    it("returns Pending for PENDING", () => {
      expect(getDeliveryStatusLabel("PENDING")).toBe("Pending");
    });

    it("returns original status for unknown", () => {
      expect(getDeliveryStatusLabel("UNKNOWN")).toBe("UNKNOWN");
    });

    it("is case-sensitive", () => {
      expect(getDeliveryStatusLabel("success")).toBe("success");
    });
  });
});
