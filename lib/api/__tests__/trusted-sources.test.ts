import { testTrustedSourceConnection } from "../trusted-sources";
import { BEARER_TOKEN } from "@/tests/telemetry/fixtures/sensitive-values";

const config = {
  name: "Payroll Source",
  endpoint: "https://payroll.example.com/api",
  apiKey: "super-secret-key",
};

describe("testTrustedSourceConnection", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns success when the endpoint reports reachable", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reachable: true }),
    } as Response);

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.status).toBe("success");
  });

  it("never sends the API key in a URL query string", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reachable: true }),
    } as Response);

    await testTrustedSourceConnection("token", config, new AbortController().signal);

    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).not.toContain(config.apiKey);
  });

  it("classifies a 401 response as unauthorized", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "invalid credentials",
    } as Response);

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.status).toBe("unauthorized");
  });

  it("classifies an aborted request as a timeout", async () => {
    global.fetch = jest.fn().mockRejectedValue(
      new DOMException("The operation was aborted.", "AbortError")
    );

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.status).toBe("timeout");
  });

  it("classifies a fetch TypeError as a network error", async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.status).toBe("network-error");
  });

  it("classifies a response missing the expected shape as a schema mismatch", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ unexpected: "shape" }),
    } as Response);

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.status).toBe("schema-mismatch");
  });

  it("redacts a bearer token echoed back in an error body", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => `Rejected: bearer ${BEARER_TOKEN} is malformed`,
    } as Response);

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.message).not.toContain(BEARER_TOKEN);
  });

  it("never includes the configured API key in the result message", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error(`Failed with key ${config.apiKey}`));

    const result = await testTrustedSourceConnection(
      "token",
      config,
      new AbortController().signal
    );

    expect(result.message).not.toContain(config.apiKey);
  });
});
