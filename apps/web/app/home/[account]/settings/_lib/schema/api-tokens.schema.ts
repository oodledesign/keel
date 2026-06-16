import { z } from 'zod';

export const createApiTokenActionSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional(),
  personal: z.boolean().optional(),
  name: z.string().trim().min(1, 'Name is required').max(120),
});

export const revokeApiTokenActionSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200).optional(),
  personal: z.boolean().optional(),
  tokenId: z.string().uuid(),
});
