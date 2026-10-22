import { bearer, fetchWithTimeout } from "./client";
import { redactMessage } from "@/lib/telemetry/redact";
import { appConfig } from "@/config/app";

export type TrustedSourceConfig = {
  name: string;
  endpoint: string;
  apiKey: string;
};

export type ConnectionTestStatus =
  | "success"
  | "timeout"
  | "unauthorized"
  | "schema-mismatch"
  | "network-error";

export type ConnectionTestResult = {
  status: ConnectionTestStatus;
  /** Always redacted before it reaches this type; never a raw credential. */
  message: string;
  testedAt: string;
};

const CONNECTION_TEST_TIMEOUT_MS = 8_000;

/**
 * redactMessage() only recognizes known credential *shapes* (JWTs, PEM
 * blocks, Stellar addresses, etc.) — an arbitrary API key string has no
 * recognizable shape, so it can slip through untouched. Since we know the
 * exact secret value here, redact it directly first as a guaranteed
 * safeguard, then apply the general redactor for anything else.
 */
function redactDiagnosticMessage(message: string, config: TrustedSourceConfig): string {
  const withKeyRedacted = config.apiKey
    ? message.split(config.apiKey).join("<api-key>")
    : message;
  return redactMessage(withKeyRedacted);
}

function classifyFailure(
  error: unknown,
  response: Response | undefined
): ConnectionTestStatus {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }
  if (response) {
    if (response.status === 401 || response.status === 403) {
      return "unauthorized";
    }
    if (response.status >= 400) {
      return "network-error";
    }
  }
  if (error instanceof TypeError) {
    return "network-error";
  }
  return "network-error";
}

/**
 * Probes a trusted source's connectivity without persisting or logging the
 * API key. This is a one-shot check (never auto-retried, unlike retryRead)
 * so a failure here reflects the actual current state rather than a masked
 * transient blip. Callers are responsible for invalidating any prior
 * successful result when the source's config fields change.
 *
 * Note: this calls a `/trusted-sources/test-connection` backend route that
 * does not exist in the current OpenAPI spec (lib/api/openapi/earnproof-api.v1.json)
 * — see this change's PR description for the expected request/response shape.
 */
export async function testTrustedSourceConnection(
  token: string,
  config: TrustedSourceConfig,
  signal: AbortSignal
): Promise<ConnectionTestResult> {
  const testedAt = new Date().toISOString();
  let response: Response | undefined;

  try {
    response = await fetchWithTimeout(
      `${appConfig.apiUrl}/trusted-sources/test-connection`,
      {
        method: "POST",
        signal,
        timeoutMs: CONNECTION_TEST_TIMEOUT_MS,
        headers: {
          "Content-Type": "application/json",
          ...bearer(token),
        },
        body: JSON.stringify({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
        }),
      }
    );

    if (!response.ok) {
      const bodyText = await response.text().catch(() => "");
      return {
        status: classifyFailure(undefined, response),
        message: redactDiagnosticMessage(
          bodyText || `Connection test failed with HTTP ${response.status}`,
          config
        ),
        testedAt,
      };
    }

    const body: unknown = await response.json().catch(() => null);
    if (!body || typeof body !== "object" || !("reachable" in body)) {
      return {
        status: "schema-mismatch",
        message: "Response did not match the expected connection-test shape.",
        testedAt,
      };
    }

    return { status: "success", message: "Connection succeeded.", testedAt };
  } catch (error) {
    return {
      status: classifyFailure(error, response),
      message: redactDiagnosticMessage(
        error instanceof Error ? error.message : "Connection test failed.",
        config
      ),
      testedAt,
    };
  }
}
