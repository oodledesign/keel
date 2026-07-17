import { z } from 'zod';

export const ActivityPrivacySettingsSchema = z.object({
  tracking_enabled: z.boolean(),
  capture_full_urls: z.boolean(),
  idle_threshold_seconds: z
    .number()
    .int()
    .min(30, 'Idle threshold must be at least 30 seconds')
    .max(3600, 'Idle threshold must be at most 3600 seconds'),
  excluded_apps: z.array(z.string().min(1)).max(100),
  excluded_domains: z.array(z.string().min(1)).max(100),
});

export type ActivityPrivacySettings = z.infer<
  typeof ActivityPrivacySettingsSchema
> & {
  account_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export const ActivityPrivacyFormSchema = z.object({
  tracking_enabled: z.boolean(),
  capture_full_urls: z.boolean(),
  idle_threshold_seconds: z.coerce
    .number()
    .int()
    .min(30, 'Idle threshold must be at least 30 seconds')
    .max(3600, 'Idle threshold must be at most 3600 seconds'),
  excluded_apps_text: z.string().max(8000),
  excluded_domains_text: z.string().max(8000),
});

export type ActivityPrivacyFormValues = z.infer<
  typeof ActivityPrivacyFormSchema
>;
