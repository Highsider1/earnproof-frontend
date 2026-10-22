import { extractSafeErrorReference } from "@/lib/errors/extract";

describe("extractSafeErrorReference", () => {
  it("extracts UUID request ID", () => {
    const response = {
      message: "Not found",
      requestId: "550e8400-e29b-41d4-a716-446655440000",
    };

    const result = extractSafeErrorReference(response, 404);

    expect(result.status).toBe(404);
    expect(result.message).toBe("Not found");
    expect(result.requestId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("extracts alphanumeric request ID", () => {
    const response = {
      message: "Internal error",
      request_id: "req-abc123-xyz789",
    };

    const result = extractSafeErrorReference(response, 500);

    expect(result.requestId).toBe("req-abc123-xyz789");
  });

  it("rejects JWT tokens", () => {
    const response = {
      message: "Unauthorized",
      requestId: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.test",
    };

    const result = extractSafeErrorReference(response, 401);

    expect(result.requestId).toBeUndefined();
  });

  it("rejects bearer tokens", () => {
    const response = {
      message: "Error",
      requestId: "Bearer abc123xyz456",
    };

    const result = extractSafeErrorReference(response, 500);

    expect(result.requestId).toBeUndefined();
  });

  it("rejects API keys", () => {
    const response = {
      message: "Error",
      requestId: "key_live_1234567890abcdef",
    };

    const result = extractSafeErrorReference(response, 500);

    expect(result.requestId).toBeUndefined();
  });

  it("handles null response body", () => {
    const result = extractSafeErrorReference(null, 500);

    expect(result.status).toBe(500);
    expect(result.message).toBe("Request failed with status 500");
    expect(result.requestId).toBeUndefined();
  });
});
