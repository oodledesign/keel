import { z } from 'zod';

const hex6 = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex colour like #0D2344');

const RESERVED_PORTAL_SLUGS = new Set([
  'www',
  'app',
  'staging',
  'localhost',
  'admin',
  'api',
  'portal',
  'auth',
  'home',
  'onboarding',
  'setup',
  'book',
  'share',
  'watch',
  'preview',
]);

export const portalSlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .refine(
    (value) => value === '' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    'Use lowercase letters, numbers, and hyphens only',
  )
  .refine(
    (value) => value === '' || value.length >= 2,
    'Slug must be at least 2 characters',
  )
  .refine(
    (value) => value === '' || !RESERVED_PORTAL_SLUGS.has(value),
    'That slug is reserved',
  );

export const saveAccountBrandSettingsSchema = z.object({
  accountId: z.string().uuid(),
  primary_color: hex6,
  secondary_color: hex6.optional().nullable(),
  accent_color: hex6.optional().nullable(),
  website_url: z.string().trim().max(500).optional().nullable(),
  address: z.string().trim().max(1000).optional().nullable(),
  portal_slug: portalSlugSchema.optional().nullable(),
});
