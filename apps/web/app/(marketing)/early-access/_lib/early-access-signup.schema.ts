import { z } from 'zod';

export const EarlyAccessSignupSchema = z.object({
  email: z.string().email().max(320),
});
