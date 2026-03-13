import { z } from 'zod';

export const AccountDetailsSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().max(100).optional(),
});
