import { z } from 'zod';

export const CreatePortalCreditTopupSchema = z.object({
  clientOrgId: z.string().uuid(),
  clientSlug: z.string().min(1),
  packId: z.string().min(1).max(64),
});

export const ListPortalRequestTypesSchema = z.object({
  clientOrgId: z.string().uuid(),
});

export const ListPortalEffectiveServicesSchema = z.object({
  clientOrgId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
});
