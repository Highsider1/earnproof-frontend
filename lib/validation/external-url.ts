const BLOCKED_SCHEMES = new Set([
  "javascript:",
  "data:",
  "file:",
  "blob:",
  "vbscript:",
  "about:",
]);

export type SafeUrlResult =
  | { ok: true; href: string; origin: string; rel: "noopener noreferrer" }
  | { ok: false; reason: "invalid" | "blocked-scheme" | "untrusted-origin" | "non-http" };

export type SafeUrlOptions = {
  allowedOrigins: readonly string[];
  requireHttps?: boolean;
};

function originFromUrl(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

/**
 * Parse a user- or config-supplied URL for injection into HTML. Untrusted
 * schemes never become hrefs, and origins must be on an explicit allow-list.
 */
export function toSafeExternalHref(raw: string, options: SafeUrlOptions): SafeUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, reason: "invalid" };
  }

  const lower = trimmed.toLowerCase();
  for (const scheme of BLOCKED_SCHEMES) {
    if (lower.startsWith(scheme)) {
      return { ok: false, reason: "blocked-scheme" };
    }
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, reason: "invalid" };
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, reason: "non-http" };
  }

  if (options.requireHttps && url.protocol !== "https:") {
    return { ok: false, reason: "non-http" };
  }

  const allowed = new Set(
    options.allowedOrigins
      .map((origin) => originFromUrl(origin) ?? origin)
      .filter(Boolean),
  );

  if (!allowed.has(url.origin)) {
    return { ok: false, reason: "untrusted-origin" };
  }

  return {
    ok: true,
    href: url.toString(),
    origin: url.origin,
    rel: "noopener noreferrer",
  };
}

export function allowedOriginsFromEnv(values: Array<string | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value));
}
