import { z } from 'zod';

export const saveWorkspaceContactSettingsSchema = z.object({
  accountId: z.string().uuid(),
  contact_email: z
    .string()
    .trim()
    .max(320)
    .optional()
    .nullable()
    .refine(
      (value) => !value || z.string().email().safeParse(value).success,
      'Enter a valid email address',
    ),
  phone: z.string().trim().max(80).optional().nullable(),
  website_url: z.string().trim().max(500).optional().nullable(),
});
