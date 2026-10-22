import {
  validateWebhookUrl,
  validateWebhookEvents,
  WEBHOOK_EVENTS,
  getSsrfGuidance,
  createWebhookSchema,
} from "./webhooks";

describe("Webhook Validation", () => {
  describe("validateWebhookUrl", () => {
    it("accepts valid HTTPS URLs", () => {
      const result = validateWebhookUrl("https://example.com/webhooks/earnproof");
      expect(result.ok).toBe(true);
    });

    it("rejects HTTP URLs", () => {
      const result = validateWebhookUrl("http://example.com/webhooks/earnproof");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("HTTPS");
    });

    it("rejects empty URLs", () => {
      const result = validateWebhookUrl("");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("required");
    });

    it("rejects invalid URLs", () => {
      const result = validateWebhookUrl("not a url");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Invalid");
    });

    it("rejects localhost", () => {
      const result = validateWebhookUrl("https://localhost:3000/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("localhost");
    });

    it("rejects 127.0.0.1", () => {
      const result = validateWebhookUrl("https://127.0.0.1/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Loopback");
    });

    it("rejects ::1 (IPv6 loopback)", () => {
      const result = validateWebhookUrl("https://[::1]/webhooks");
      expect(result.ok).toBe(false);
    });

    it("rejects private IPv4 ranges (10.x.x.x)", () => {
      const result = validateWebhookUrl("https://10.0.0.1/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Private");
    });

    it("rejects private IPv4 ranges (172.16-31.x.x)", () => {
      const result1 = validateWebhookUrl("https://172.16.0.1/webhooks");
      expect(result1.ok).toBe(false);

      const result2 = validateWebhookUrl("https://172.31.255.255/webhooks");
      expect(result2.ok).toBe(false);
    });

    it("rejects private IPv4 ranges (192.168.x.x)", () => {
      const result = validateWebhookUrl("https://192.168.1.1/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Private");
    });

    it("rejects link-local addresses (169.254.x.x)", () => {
      const result = validateWebhookUrl("https://169.254.1.1/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Link-local");
    });

    it("rejects multicast ranges (224-239.x.x.x)", () => {
      const result = validateWebhookUrl("https://224.0.0.1/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Multicast");
    });

    it("rejects 0.0.0.0", () => {
      const result = validateWebhookUrl("https://0.0.0.0/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("Invalid");
    });

    it("rejects AWS metadata service", () => {
      const result = validateWebhookUrl("https://169.254.169.254/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("metadata");
    });

    it("rejects Google metadata service", () => {
      const result = validateWebhookUrl("https://metadata.google.internal/webhooks");
      expect(result.ok).toBe(false);
      expect(result.ok === false && result.reason).toContain("metadata");
    });

    it("accepts valid public domain URLs", () => {
      const result = validateWebhookUrl("https://webhook.site/unique-id");
      expect(result.ok).toBe(true);
    });

    it("accepts URLs with paths and query parameters", () => {
      const result = validateWebhookUrl("https://api.example.com/webhooks/earnproof?token=abc123");
      expect(result.ok).toBe(true);
    });

    it("trims whitespace", () => {
      const result = validateWebhookUrl("  https://example.com/webhooks  ");
      expect(result.ok).toBe(true);
    });
  });

  describe("validateWebhookEvents", () => {
    it("accepts single valid event", () => {
      const result = validateWebhookEvents(["proof.created"]);
      expect(result).toBeNull();
    });

    it("accepts multiple valid events", () => {
      const result = validateWebhookEvents(["proof.created", "proof.verified", "proof.revoked"]);
      expect(result).toBeNull();
    });

    it("rejects empty event array", () => {
      const result = validateWebhookEvents([]);
      expect(result).toContain("At least one");
    });

    it("rejects invalid event types", () => {
      const result = validateWebhookEvents(["invalid.event"]);
      expect(result).toContain("Invalid");
    });

    it("rejects duplicate events", () => {
      const result = validateWebhookEvents(["proof.created", "proof.created"]);
      expect(result).toContain("Duplicate");
    });

    it("rejects mix of valid and invalid events", () => {
      const result = validateWebhookEvents(["proof.created", "invalid.event"]);
      expect(result).toContain("Invalid");
    });

    it("accepts all defined WEBHOOK_EVENTS", () => {
      const result = validateWebhookEvents([...WEBHOOK_EVENTS]);
      expect(result).toBeNull();
    });
  });

  describe("getSsrfGuidance", () => {
    it("returns guidance text", () => {
      const guidance = getSsrfGuidance();
      expect(guidance).toBeTruthy();
      expect(guidance).toContain("HTTPS");
      expect(guidance).toContain("private");
    });
  });

  describe("createWebhookSchema", () => {
    it("validates a correct webhook creation input", () => {
      const input = {
        url: "https://example.com/webhooks",
        events: ["proof.created"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it("rejects input without URL", () => {
      const input = {
        url: "",
        events: ["proof.created"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects input without events", () => {
      const input = {
        url: "https://example.com/webhooks",
        events: [],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects input with HTTP URL", () => {
      const input = {
        url: "http://example.com/webhooks",
        events: ["proof.created"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects input with SSRF-vulnerable URL", () => {
      const input = {
        url: "https://127.0.0.1/webhooks",
        events: ["proof.created"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("rejects input with duplicate events", () => {
      const input = {
        url: "https://example.com/webhooks",
        events: ["proof.created", "proof.created"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(false);
    });

    it("accepts all three events", () => {
      const input = {
        url: "https://example.com/webhooks",
        events: ["proof.created", "proof.verified", "proof.revoked"],
      };
      const result = createWebhookSchema.safeParse(input);
      expect(result.success).toBe(true);
    });
  });
});
