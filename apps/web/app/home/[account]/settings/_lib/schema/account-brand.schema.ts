import { z } from 'zod';

const hex6 = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #0D2344');

export const saveAccountBrandSettingsSchema = z.object({
  accountId: z.string().uuid(),
  primary_color: hex6,
  secondary_color: hex6.optional().nullable(),
  accent_color: hex6.optional().nullable(),
  logoDataUrl: z.string().optional().nullable(),
  clearLogo: z.boolean().optional(),
});
