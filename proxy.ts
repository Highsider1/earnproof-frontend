import { NextRequest, NextResponse } from "next/server";
import { buildSecurityPolicy } from "@/config/security-headers";
import { isEmbedRoute } from "@/lib/security/embed-route";

function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const allowEmbedding = isEmbedRoute(request.nextUrl.pathname);
  const policy = buildSecurityPolicy({ nonce, allowEmbedding });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", policy.csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  for (const header of policy.headers) {
    response.headers.set(header.key, header.value);
  }

  // `next.config.ts`'s static `headers()` rule ALSO sets `X-Frame-Options:
  // DENY` on every route (it has no per-route awareness of embed routes —
  // see the comment there for why a second static rule isn't the fix
  // either). Next.js layers config-level headers with middleware response
  // headers per KEY: a key this middleware explicitly `.set()`s (like
  // Content-Security-Policy, above) is replaced, but a key this middleware
  // stays silent on is NOT cleared — it keeps the config-level value. That
  // means simply omitting X-Frame-Options from `policy.headers` for embed
  // routes (which `allowEmbedding` already does) is not enough to remove
  // it; the stale `DENY` from next.config.ts otherwise survives and
  // contradicts `frame-ancestors *`, defeating the embed carve-out. This
  // was caught by manually inspecting real response headers from `next
  // start` for /embed/v1/verify/... during validation — deleting the key
  // explicitly here is required, not optional.
  if (allowEmbedding) {
    response.headers.delete("X-Frame-Options");
  }

  return response;
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
    },
  ],
};
