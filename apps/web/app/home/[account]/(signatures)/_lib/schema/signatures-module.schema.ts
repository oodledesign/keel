import { z } from 'zod';

const emptyToNull = z
  .string()
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

export const syncStaffActionSchema = z.object({
  accountId: z.string().uuid(),
});

export const pushAllActionSchema = z.object({
  accountId: z.string().uuid(),
});

export const pushStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  staffId: z.string().uuid(),
});

export const disconnectM365ActionSchema = z.object({
  accountId: z.string().uuid(),
});

export const connectGoogleWorkspaceActionSchema = z.object({
  accountId: z.string().uuid(),
  primaryDomain: z
    .string()
    .trim()
    .min(3, 'Domain is required')
    .max(253)
    .transform((value) => value.toLowerCase()),
  delegatedAdminEmail: z.string().trim().email('Valid admin email required'),
});

export const disconnectGoogleActionSchema = z.object({
  accountId: z.string().uuid(),
});

export const upsertDepartmentBadgeActionSchema = z.object({
  accountId: z.string().uuid(),
  department: z.string().trim().min(1, 'Department is required').max(120),
  award_badge_url: z.string().trim().url('Valid badge image URL required'),
});

export const deleteDepartmentBadgeActionSchema = z.object({
  accountId: z.string().uuid(),
  department: z.string().trim().min(1, 'Department is required').max(120),
});

export const updateStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  staffId: z.string().uuid(),
  full_name: emptyToNull,
  job_title: emptyToNull,
  department: emptyToNull,
  phone_direct: emptyToNull,
  phone_mobile: emptyToNull,
  branch_id: z.string().uuid().nullable().optional(),
  signature_email: emptyToNull,
  photoDataUrl: z.string().optional().nullable(),
  templateId: z.string().uuid().nullable().optional(),
});

export const saveTemplateActionSchema = z.object({
  accountId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().trim().min(1, 'Template name is required').max(120),
  html_template: z.string().trim().min(1, 'HTML template is required'),
  is_default: z.boolean().default(false),
});
