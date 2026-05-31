import { z } from 'zod';

const optionalNullableString = z.string().nullable().optional();
const optionalNullableUuid = z.string().uuid().nullable().optional();

export const WebsiteStackSchema = z.enum([
  'next-payload',
  'webflow',
  'wordpress',
  'other',
]);

export const WebsiteStatusSchema = z.enum([
  'in-progress',
  'live',
  'maintenance',
  'paused',
  'archived',
]);

export const ListWebsitesSchema = z.object({
  accountId: z.string().uuid(),
  status: WebsiteStatusSchema.optional(),
});

export const GetWebsiteSchema = z.object({
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
});

export const WebsiteInputSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
  domain: optionalNullableString,
  staging_url: optionalNullableString,
  stack: WebsiteStackSchema.default('other'),
  status: WebsiteStatusSchema.default('in-progress'),
  client_org_id: optionalNullableUuid,
  cms_admin_url: optionalNullableString,
  vercel_project_id: optionalNullableString,
  github_repo_url: optionalNullableString,
  supabase_schema: optionalNullableString,
  notes: optionalNullableString,
  hosting_notes: optionalNullableString,
  launched_at: optionalNullableString,
  umami_website_id: optionalNullableString,
  umami_share_url: optionalNullableString,
});

export const UpdateWebsiteSchema = WebsiteInputSchema.extend({
  websiteId: z.string().uuid(),
}).omit({ accountId: true });

export const DeleteWebsiteSchema = z.object({
  accountId: z.string().uuid(),
  websiteId: z.string().uuid(),
});

export type WebsiteStack = z.infer<typeof WebsiteStackSchema>;
export type WebsiteStatus = z.infer<typeof WebsiteStatusSchema>;
export type ListWebsitesInput = z.infer<typeof ListWebsitesSchema>;
export type GetWebsiteInput = z.infer<typeof GetWebsiteSchema>;
export type WebsiteInput = z.infer<typeof WebsiteInputSchema>;
export type UpdateWebsiteInput = z.infer<typeof UpdateWebsiteSchema>;
export type DeleteWebsiteInput = z.infer<typeof DeleteWebsiteSchema>;
