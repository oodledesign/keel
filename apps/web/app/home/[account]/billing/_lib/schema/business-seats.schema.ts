import { z } from 'zod';

export const UpdateBusinessSeatQuantitySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
});
