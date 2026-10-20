import { z } from "zod";

export const SHARE_EXPIRY_OPTIONS_HOURS = [1, 24, 72, 168] as const; // 1h, 1d, 3d, 7d

export type ShareExpiryHours = (typeof SHARE_EXPIRY_OPTIONS_HOURS)[number];

/**
 * Mirrors the disclosure shape already used by payment-receipt and
 * recurring-income proofs (see lib/api/payment-receipt-proofs.ts): a
 * sharing link can widen disclosure beyond the credential's own privacy
 * flags, so the reviewer must see and accept exactly the policy that will
 * be baked into the created token.
 */
export const createShareLinkSchema = z.object({
  proofId: z.string().min(1, "A proof is required"),
  expiresInHours: z.number().refine((value) => (SHARE_EXPIRY_OPTIONS_HOURS as readonly number[]).includes(value), {
    message: "Choose a supported expiry",
  }),
  discloseAmount: z.boolean(),
  discloseSender: z.boolean(),
});

export type CreateShareLinkInput = z.infer<typeof createShareLinkSchema>;

export type ShareLinkStatus = "ACTIVE" | "EXPIRED" | "REVOKED";

export function computeShareLinkStatus(expiresAt: string, revokedAt: string | null, now: number = Date.now()): ShareLinkStatus {
  if (revokedAt) {
    return "REVOKED";
  }
  if (new Date(expiresAt).getTime() <= now) {
    return "EXPIRED";
  }
  return "ACTIVE";
}
