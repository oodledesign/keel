import { z } from 'zod';

export const CreatePortalCreditTopupSchema = z.object({
  clientOrgId: z.string().uuid(),
  clientSlug: z.string().min(1),
  packId: z.enum(['small', 'medium', 'large']),
});

export const ListPortalRequestTypesSchema = z.object({
  clientOrgId: z.string().uuid(),
});
