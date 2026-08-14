import { z } from 'zod';

export const UpdateCommercialSeatQuantitySchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  quantity: z.number().int().min(1).max(200),
});

export type UpdateCommercialSeatQuantityInput = z.infer<
  typeof UpdateCommercialSeatQuantitySchema
>;
