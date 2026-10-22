import { z } from "zod";

export const createTrustedSourceSchema = z.object({
  name: z
    .string()
    .min(2, "Trusted source name must be at least 2 characters")
    .max(100, "Trusted source name must be less than 100 characters")
    .trim(),
  issuerId: z.string().min(1, "An issuer must be selected"),
});

export const updateTrustedSourceSchema = createTrustedSourceSchema.partial();

export type CreateTrustedSourceInput = z.infer<typeof createTrustedSourceSchema>;
export type UpdateTrustedSourceInput = z.infer<typeof updateTrustedSourceSchema>;
