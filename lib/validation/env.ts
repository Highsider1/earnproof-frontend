import { z } from "zod";

export const DEPLOYMENT_PROFILES = ["local", "preview", "production"] as const;
export type DeploymentProfile = (typeof DEPLOYMENT_PROFILES)[number];

export const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_STELLAR_NETWORK: z.literal("testnet"),
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: z.string().min(1),
  NEXT_PUBLIC_STELLAR_HORIZON_URL: z.string().url(),
  NEXT_PUBLIC_HELP_URL: z.string().url().optional(),
  NEXT_PUBLIC_STELLAR_EXPLORER_URL: z.string().url().optional(),
  NEXT_PUBLIC_WEB_VITALS_ENDPOINT: z.string().url().optional(),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

type PublicEnvDefaults = Pick<
  PublicEnv,
  | "NEXT_PUBLIC_APP_URL"
  | "NEXT_PUBLIC_API_URL"
  | "NEXT_PUBLIC_STELLAR_NETWORK"
  | "NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE"
  | "NEXT_PUBLIC_STELLAR_HORIZON_URL"
  | "NEXT_PUBLIC_HELP_URL"
>;

const LOCAL_DEFAULTS: PublicEnvDefaults = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  NEXT_PUBLIC_API_URL: "http://localhost:4000/api/v1",
  NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
  NEXT_PUBLIC_HELP_URL: "https://help.earnproof.com",
};

export type EnvLike = Record<string, string | undefined>;

export function resolveDeploymentProfile(env: EnvLike = process.env): DeploymentProfile {
  const vercelEnv = env.VERCEL_ENV;
  if (vercelEnv === "production") return "production";
  if (vercelEnv === "preview") return "preview";
  if (env.NODE_ENV === "production" && env.EARNPROOF_REQUIRE_SECURITY_ORIGINS === "true") {
    return "production";
  }
  return "local";
}

function vercelHttpsOrigin(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) return undefined;

  const withProtocol = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    const url = new URL(withProtocol);
    return url.protocol === "https:" ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

function publicDefaults(env: EnvLike): PublicEnvDefaults {
  if (resolveDeploymentProfile(env) !== "preview") {
    return LOCAL_DEFAULTS;
  }

  return {
    ...LOCAL_DEFAULTS,
    NEXT_PUBLIC_APP_URL:
      vercelHttpsOrigin(env.VERCEL_BRANCH_URL) ??
      vercelHttpsOrigin(env.VERCEL_URL) ??
      LOCAL_DEFAULTS.NEXT_PUBLIC_APP_URL,
  };
}

export function originsAreRequired(env: EnvLike = process.env): boolean {
  const profile = resolveDeploymentProfile(env);
  return (
    profile === "production" ||
    env.EARNPROOF_REQUIRE_SECURITY_ORIGINS === "true"
  );
}

/**
 * Load and validate public environment. Production (or an explicit
 * `EARNPROOF_REQUIRE_SECURITY_ORIGINS=true` flag) fails closed when required
 * origins are missing. Local, CI, and preview `next build` keep documented
 * testnet defaults so the app can compile without a Vercel/runtime env file.
 */
export function loadPublicEnv(env: EnvLike = process.env): PublicEnv {
  const required = originsAreRequired(env);
  const defaults = publicDefaults(env);
  const candidate = {
    NEXT_PUBLIC_APP_URL:
      env.NEXT_PUBLIC_APP_URL ?? (required ? undefined : defaults.NEXT_PUBLIC_APP_URL),
    NEXT_PUBLIC_API_URL:
      env.NEXT_PUBLIC_API_URL ?? (required ? undefined : defaults.NEXT_PUBLIC_API_URL),
    NEXT_PUBLIC_STELLAR_NETWORK:
      env.NEXT_PUBLIC_STELLAR_NETWORK ??
      (required ? undefined : defaults.NEXT_PUBLIC_STELLAR_NETWORK),
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE:
      env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE ??
      (required ? undefined : defaults.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE),
    NEXT_PUBLIC_STELLAR_HORIZON_URL:
      env.NEXT_PUBLIC_STELLAR_HORIZON_URL ??
      (required ? undefined : defaults.NEXT_PUBLIC_STELLAR_HORIZON_URL),
    NEXT_PUBLIC_HELP_URL:
      env.NEXT_PUBLIC_HELP_URL ?? (required ? undefined : defaults.NEXT_PUBLIC_HELP_URL),
    NEXT_PUBLIC_STELLAR_EXPLORER_URL: env.NEXT_PUBLIC_STELLAR_EXPLORER_URL,
    NEXT_PUBLIC_WEB_VITALS_ENDPOINT: env.NEXT_PUBLIC_WEB_VITALS_ENDPOINT,
  };

  const parsed = publicEnvSchema.safeParse(candidate);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((issue) => issue.path.join("."))
      .filter(Boolean);
    const profile = resolveDeploymentProfile(env);
    throw new Error(
      `EarnProof public origins are missing or invalid for the ${profile} policy. ` +
        `Set ${missing.join(", ") || "required NEXT_PUBLIC_* origin variables"} ` +
        `before serving wallet, API, or QR traffic.`,
    );
  }

  return parsed.data;
}
