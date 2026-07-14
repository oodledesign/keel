import { z } from 'zod';

export const CreatePortalManagePaymentSessionSchema = z.object({
  clientOrgId: z.string().uuid(),
  clientSlug: z.string().min(1).max(120),
});
