import { z } from 'zod';

const hex6 = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #0D2344');

export const saveAccountBrandSettingsSchema = z.object({
  accountId: z.string().uuid(),
  primary_color: hex6,
  secondary_color: hex6.optional().nullable(),
  accent_color: hex6.optional().nullable(),
  website_url: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  clearLogo: z.boolean().optional(),
});
