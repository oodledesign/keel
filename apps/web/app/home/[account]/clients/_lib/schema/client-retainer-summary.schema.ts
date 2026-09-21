import { z } from 'zod';

export const ListClientRetainerSummarySchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid(),
});
