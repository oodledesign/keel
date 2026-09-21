import { z } from 'zod';

export const CreatePortalCreditTopupSchema = z.object({
  clientOrgId: z.string().uuid(),
  clientSlug: z.string().min(1),
  packId: z.enum(['small', 'medium', 'large']),
});

export const ListPortalRequestTypesSchema = z.object({
  clientOrgId: z.string().uuid(),
});

export const ListPortalEffectiveServicesSchema = z.object({
  clientOrgId: z.string().uuid(),
  projectId: z.string().uuid().nullable().optional(),
});
