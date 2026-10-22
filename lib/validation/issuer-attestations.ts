import { z } from "zod";
import { ATTESTATION_TYPES } from "@/lib/api/issuer-attestations";

export const attestationTypeSchema = z.enum(ATTESTATION_TYPES);

export const createAttestationSchema = z.object({
  subjectWalletHash: z
    .string()
    .trim()
    .regex(/^sha256:[a-f0-9]{64}$/i, "Enter a valid wallet hash (sha256:<64 hex characters>)"),
  type: attestationTypeSchema,
  expiresInDays: z
    .number()
    .int()
    .min(1, "Expiry must be at least 1 day")
    .max(365, "Expiry cannot exceed 365 days"),
});

export type CreateAttestationInput = z.infer<typeof createAttestationSchema>;

export const DEFAULT_ATTESTATION_EXPIRY_DAYS = 90;
