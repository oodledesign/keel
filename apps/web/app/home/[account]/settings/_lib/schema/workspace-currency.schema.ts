import { z } from 'zod';

import { WorkspaceCurrencySchema } from '~/lib/currency/workspace-currency';

export const saveWorkspaceCurrencySchema = z.object({
  accountId: z.string().uuid(),
  default_currency: WorkspaceCurrencySchema,
});
