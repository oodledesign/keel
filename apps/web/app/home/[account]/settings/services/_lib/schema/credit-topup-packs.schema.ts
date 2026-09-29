import { z } from 'zod';

import { CreditTopupPackListSchema } from '~/lib/credits/credit-topup-packs';

export const UpdateCreditTopupPacksSchema = z.object({
  accountId: z.string().uuid(),
  /** Null resets to the default packs. */
  packs: CreditTopupPackListSchema.nullable(),
});
