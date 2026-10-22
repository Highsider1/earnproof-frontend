import { z } from "zod";
import { ORGANIZATION_ROLES } from "@/lib/api/organization-members";

export const organizationRoleSchema = z.enum(ORGANIZATION_ROLES);

export const inviteOrganizationMemberSchema = z.object({
  walletAddress: z
    .string()
    .trim()
    .regex(/^G[A-Z2-7]{55}$/, "Enter a valid Stellar public key (starts with G, 56 characters)"),
  role: organizationRoleSchema,
});

export type InviteOrganizationMemberInput = z.infer<typeof inviteOrganizationMemberSchema>;

export const updateOrganizationMemberRoleSchema = z.object({
  role: organizationRoleSchema,
});

export type UpdateOrganizationMemberRoleInput = z.infer<typeof updateOrganizationMemberRoleSchema>;
