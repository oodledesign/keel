import { z } from 'zod';

import type { GmailVacationSettings } from '~/lib/gmail/vacation-responder';

export const WorkspaceFocusSettingsSchema = z
  .object({
    silence_outside_hours: z.boolean(),
    work_days: z
      .array(z.number().min(0).max(6))
      .min(1, 'Select at least one work day'),
    work_start_time: z
      .string()
      .regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    work_end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Invalid time format'),
    timezone: z.string().min(1),
    holiday_mode_enabled: z.boolean(),
    holiday_mode_label: z.string().min(1).max(50),
    holiday_mode_until: z.string().datetime().nullable(),
    ooo_enabled: z.boolean(),
    ooo_trigger: z.enum([
      'manual',
      'outside_hours',
      'holiday_only',
      'outside_hours_or_holiday',
      'outside_hours_and_holiday',
      'always',
    ]),
    ooo_message: z.string().max(2000),
    ooo_holiday_message: z.string().max(2000).nullable(),
    ooo_sender_name: z.string().max(100).nullable(),
    ooo_cc_email: z.union([z.string().email(), z.literal(''), z.null()]),
    ooo_include_return_date: z.boolean(),
  })
  .refine((d) => d.work_start_time < d.work_end_time, {
    message: 'Work end time must be after start time',
    path: ['work_end_time'],
  })
  .refine((d) => !d.ooo_enabled || d.ooo_message.length > 0, {
    message: 'Please enter an OOO message',
    path: ['ooo_message'],
  });

export type WorkspaceFocusSettings = z.infer<
  typeof WorkspaceFocusSettingsSchema
> & {
  id: string;
  account_id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

export type GmailVacationStatus =
  | GmailVacationSettings
  | null
  | 'not_connected'
  | 'scope_missing';
