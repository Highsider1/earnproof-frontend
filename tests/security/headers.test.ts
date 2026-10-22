import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSecurityPolicy } from "@/config/security-headers";
import { loadPublicEnv, resolveDeploymentProfile } from "@/lib/validation/env";
import { toSafeExternalHref } from "@/lib/validation/external-url";

const fixtures = JSON.parse(
  readFileSync(join(__dirname, "fixtures/blocked-content.json"), "utf8"),
) as {
  unapprovedInlineScript: string;
  unapprovedConnectOrigin: string;
  unapprovedFrame: string;
  javascriptHref: string;
  dataHref: string;
  fileHref: string;
  trustedHelp: string;
};

const localEnv = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  NEXT_PUBLIC_HELP_URL: "https://help.earnproof.com",
};

function cspDirective(csp: string, name: string): string {
  return csp
    .split(";")
    .map((directive) => directive.trim())
    .find((directive) => directive.startsWith(`${name} `)) ?? "";
}

describe("browser security policy", () => {
  it("emits explicit frame, MIME, referrer, permissions, and CSP headers", () => {
    const policy = buildSecurityPolicy({
      env: localEnv,
      nonce: "test-nonce",
    });
    const keys = policy.headers.map((header) => header.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    expect(policy.headers.find((header) => header.key === "X-Frame-Options")?.value).toBe(
      "DENY",
    );
    expect(
      policy.headers.find((header) => header.key === "X-Content-Type-Options")?.value,
    ).toBe("nosniff");
    expect(
      policy.headers.find((header) => header.key === "Referrer-Policy")?.value,
    ).toBe("strict-origin-when-cross-origin");
    expect(
      policy.headers.find((header) => header.key === "Permissions-Policy")?.value,
    ).toContain("camera=(self)");
  });

  it("does not add unsafe-inline or host wildcards to script, connect, or style element sources", () => {
    const policy = buildSecurityPolicy({ env: localEnv, nonce: "test-nonce" });
    const scriptSrc = cspDirective(policy.csp, "script-src");
    const connectSrc = cspDirective(policy.csp, "connect-src");
    const styleSrc = cspDirective(policy.csp, "style-src");
    const styleSrcElem = cspDirective(policy.csp, "style-src-elem");
    const styleSrcAttr = cspDirective(policy.csp, "style-src-attr");

    expect(scriptSrc).not.toMatch(/unsafe-inline/);
    expect(styleSrc).not.toMatch(/unsafe-inline/);
    expect(styleSrcElem).not.toMatch(/unsafe-inline/);
    expect(scriptSrc).not.toMatch(/\*/);
    expect(connectSrc).not.toMatch(/\*/);
    expect(policy.csp).toContain("'nonce-test-nonce'");
    expect(styleSrcAttr).toBe("style-src-attr 'unsafe-inline'");
    expect(policy.csp).toContain("object-src 'none'");
    expect(policy.csp).toContain("frame-src 'none'");
    expect(policy.csp).toContain("frame-ancestors 'none'");
  });

  it("allows documented wallet/API origins and blocks unapproved connect/frame hosts", () => {
    const policy = buildSecurityPolicy({ env: localEnv, nonce: "test-nonce" });

    expect(policy.connectSrc).toEqual(
      expect.arrayContaining([
        "'self'",
        "http://localhost:3000",
        "http://localhost:4000",
        "https://horizon-testnet.stellar.org",
      ]),
    );
    expect(policy.csp).not.toContain(fixtures.unapprovedConnectOrigin);
    expect(policy.csp).not.toContain(fixtures.unapprovedFrame);
    expect(policy.csp).not.toContain(fixtures.unapprovedInlineScript);
  });

  it("enables HSTS only for https app origins", () => {
    const httpPolicy = buildSecurityPolicy({ env: localEnv, nonce: "n" });
    expect(httpPolicy.headers.some((header) => header.key === "Strict-Transport-Security")).toBe(
      false,
    );

    const httpsPolicy = buildSecurityPolicy({
      env: {
        ...localEnv,
        NEXT_PUBLIC_APP_URL: "https://app.earnproof.example",
      },
      nonce: "n",
    });
    expect(
      httpsPolicy.headers.find((header) => header.key === "Strict-Transport-Security")?.value,
    ).toContain("max-age=63072000");
    expect(httpsPolicy.csp).toContain("upgrade-insecure-requests");
  });
});

describe("embeddable verification widget CSP carve-out (issue #196)", () => {
  it("keeps frame-ancestors 'none' and X-Frame-Options: DENY when allowEmbedding is not passed", () => {
    const policy = buildSecurityPolicy({ env: localEnv, nonce: "test-nonce" });

    expect(policy.csp).toContain("frame-ancestors 'none'");
    expect(policy.headers.find((header) => header.key === "X-Frame-Options")?.value).toBe(
      "DENY",
    );
  });

  it("keeps frame-ancestors 'none' and X-Frame-Options: DENY when allowEmbedding is explicitly false", () => {
    const policy = buildSecurityPolicy({
      env: localEnv,
      nonce: "test-nonce",
      allowEmbedding: false,
    });

    expect(policy.csp).toContain("frame-ancestors 'none'");
    expect(policy.headers.find((header) => header.key === "X-Frame-Options")?.value).toBe(
      "DENY",
    );
  });

  it("only widens frame-ancestors and drops X-Frame-Options when allowEmbedding is true", () => {
    const strictPolicy = buildSecurityPolicy({ env: localEnv, nonce: "test-nonce" });
    const embedPolicy = buildSecurityPolicy({
      env: localEnv,
      nonce: "test-nonce",
      allowEmbedding: true,
    });

    expect(embedPolicy.csp).toContain("frame-ancestors *");
    expect(embedPolicy.csp).not.toContain("frame-ancestors 'none'");
    expect(embedPolicy.headers.some((header) => header.key === "X-Frame-Options")).toBe(false);

    // Every other directive/header must be byte-for-byte identical to the
    // strict policy — this option is a framing-only carve-out, not a
    // general "looser CSP for embeds" switch.
    const stripFrameAncestors = (csp: string) =>
      csp
        .split(";")
        .map((directive) => directive.trim())
        .filter((directive) => !directive.startsWith("frame-ancestors "))
        .join(";");
    expect(stripFrameAncestors(embedPolicy.csp)).toBe(stripFrameAncestors(strictPolicy.csp));

    const nonFrameHeaders = (policy: typeof strictPolicy) =>
      policy.headers.filter((header) => header.key !== "X-Frame-Options" && header.key !== "Content-Security-Policy");
    expect(nonFrameHeaders(embedPolicy)).toEqual(nonFrameHeaders(strictPolicy));

    expect(embedPolicy.scriptSrc).toEqual(strictPolicy.scriptSrc);
    expect(embedPolicy.connectSrc).toEqual(strictPolicy.connectSrc);
  });

  it("still blocks unapproved connect/frame hosts and inline script under the embed policy", () => {
    const embedPolicy = buildSecurityPolicy({
      env: localEnv,
      nonce: "test-nonce",
      allowEmbedding: true,
    });

    expect(embedPolicy.csp).not.toContain(fixtures.unapprovedConnectOrigin);
    expect(embedPolicy.csp).not.toContain(fixtures.unapprovedInlineScript);
    expect(cspDirective(embedPolicy.csp, "script-src")).not.toMatch(/unsafe-inline/);
    expect(cspDirective(embedPolicy.csp, "script-src")).not.toMatch(/\*/);
    expect(embedPolicy.csp).toContain("object-src 'none'");
  });
});

describe("deployment origin requirements", () => {
  it("uses local defaults when preview/production origins are not required", () => {
    expect(resolveDeploymentProfile({})).toBe("local");
    expect(loadPublicEnv({}).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("uses Vercel preview URLs with documented testnet defaults", () => {
    const env = loadPublicEnv({
      VERCEL_ENV: "preview",
      VERCEL_BRANCH_URL: "earnproof-git-fix-codebase-hallabs-projects.vercel.app",
    });

    expect(resolveDeploymentProfile({ VERCEL_ENV: "preview" })).toBe("preview");
    expect(env.NEXT_PUBLIC_APP_URL).toBe(
      "https://earnproof-git-fix-codebase-hallabs-projects.vercel.app",
    );
    expect(env.NEXT_PUBLIC_API_URL).toBe("http://localhost:4000/api/v1");
    expect(env.NEXT_PUBLIC_STELLAR_HORIZON_URL).toBe(
      "https://horizon-testnet.stellar.org",
    );
  });

  it("fails clearly when preview origins are explicitly required", () => {
    expect(() =>
      loadPublicEnv({
        VERCEL_ENV: "preview",
        EARNPROOF_REQUIRE_SECURITY_ORIGINS: "true",
      }),
    ).toThrow(/preview policy/);
  });

  it("fails clearly when production origins are missing", () => {
    expect(() =>
      loadPublicEnv({
        VERCEL_ENV: "production",
      }),
    ).toThrow(/production policy/);
  });

  it("accepts a complete production origin set", () => {
    const env = loadPublicEnv({
      VERCEL_ENV: "production",
      NEXT_PUBLIC_APP_URL: "https://app.earnproof.example",
      NEXT_PUBLIC_API_URL: "https://api.earnproof.example/api/v1",
      NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
      NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
      NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
      NEXT_PUBLIC_HELP_URL: "https://help.earnproof.com",
    });
    expect(env.NEXT_PUBLIC_APP_URL).toBe("https://app.earnproof.example");
  });
});

describe("external URL safety", () => {
  const allowedOrigins = ["https://help.earnproof.com"];

  it("allows documented HTTPS help links with safe rel", () => {
    const result = toSafeExternalHref(fixtures.trustedHelp, { allowedOrigins });
    expect(result).toEqual({
      ok: true,
      href: fixtures.trustedHelp,
      origin: "https://help.earnproof.com",
      rel: "noopener noreferrer",
    });
  });

  it("rejects javascript, data, and file URLs without rendering them", () => {
    expect(toSafeExternalHref(fixtures.javascriptHref, { allowedOrigins }).ok).toBe(false);
    expect(toSafeExternalHref(fixtures.dataHref, { allowedOrigins }).ok).toBe(false);
    expect(toSafeExternalHref(fixtures.fileHref, { allowedOrigins }).ok).toBe(false);
  });

  it("rejects unapproved origins", () => {
    expect(
      toSafeExternalHref(fixtures.unapprovedConnectOrigin, { allowedOrigins }).ok,
    ).toBe(false);
  });
});
