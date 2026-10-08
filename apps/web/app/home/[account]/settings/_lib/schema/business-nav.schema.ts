import { z } from 'zod';

import { BUSINESS_NAV_CHOICE_KEYS } from '~/home/[account]/_lib/business-nav-preferences';

export const saveBusinessNavSchema = z.object({
  accountId: z.string().uuid(),
  visible: z
    .record(z.string(), z.boolean())
    .refine(
      (visible) =>
        Object.keys(visible).every((key) =>
          BUSINESS_NAV_CHOICE_KEYS.includes(key),
        ),
      'Unknown navigation link',
    ),
});

export type SaveBusinessNavInput = z.infer<typeof saveBusinessNavSchema>;
