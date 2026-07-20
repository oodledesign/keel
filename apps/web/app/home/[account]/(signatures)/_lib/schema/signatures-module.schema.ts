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

export const upsertDepartmentBadgeActionSchema = z
  .object({
    accountId: z.string().uuid(),
    department: z.string().trim().min(1, 'Department is required').max(120),
    award_badge_url: z.string().trim().optional().default(''),
    badgeDataUrl: z
      .string()
      .max(3_500_000, 'Badge is too large. Try a smaller image.')
      .optional()
      .nullable(),
  })
  .superRefine((value, ctx) => {
    const ALLOWED = [
      'data:image/png;',
      'data:image/jpeg;',
      'data:image/webp;',
      'data:image/gif;',
    ];
    if (
      value.badgeDataUrl &&
      ALLOWED.some((prefix) => value.badgeDataUrl!.startsWith(prefix))
    ) {
      return;
    }
    if (value.badgeDataUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['badgeDataUrl'],
        message: 'Only PNG, JPEG, WebP, and GIF images are accepted',
      });
      return;
    }

    const url = value.award_badge_url?.trim() ?? '';
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['award_badge_url'],
        message: 'Upload a badge image or paste a valid image URL',
      });
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported');
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['award_badge_url'],
        message: 'Valid badge image URL required',
      });
    }
  });

export const deleteDepartmentBadgeActionSchema = z.object({
  accountId: z.string().uuid(),
  department: z.string().trim().min(1, 'Department is required').max(120),
});

export const upsertSignatureAssetActionSchema = z
  .object({
    accountId: z.string().uuid(),
    id: z.string().uuid().optional().nullable(),
    kind: z.enum(['custom_text', 'award_badge']),
    scope: z.enum(['workspace', 'department', 'branch']),
    department: z.string().trim().max(120).optional().nullable(),
    branchId: z.string().uuid().optional().nullable(),
    label: z.string().trim().min(1, 'Label is required').max(120),
    body: z.string().trim().max(4000).optional().nullable(),
    award_badge_url: z.string().trim().optional().default(''),
    badgeDataUrl: z
      .string()
      .max(3_500_000, 'Badge is too large. Try a smaller image.')
      .optional()
      .nullable(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
  })
  .superRefine((value, ctx) => {
    if (value.scope === 'department' && !value.department?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['department'],
        message: 'Select a department',
      });
    }
    if (value.scope === 'branch' && !value.branchId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['branchId'],
        message: 'Select a branch',
      });
    }

    if (value.kind === 'custom_text') {
      if (!value.body?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['body'],
          message: 'Enter the shared text',
        });
      }
      return;
    }

    const ALLOWED = [
      'data:image/png;',
      'data:image/jpeg;',
      'data:image/webp;',
      'data:image/gif;',
    ];
    if (
      value.badgeDataUrl &&
      ALLOWED.some((prefix) => value.badgeDataUrl!.startsWith(prefix))
    ) {
      return;
    }
    if (value.badgeDataUrl) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['badgeDataUrl'],
        message: 'Only PNG, JPEG, WebP, and GIF images are accepted',
      });
      return;
    }

    const url = value.award_badge_url?.trim() ?? '';
    if (!url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['award_badge_url'],
        message: 'Upload a badge image or paste a valid image URL',
      });
      return;
    }

    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('unsupported');
      }
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['award_badge_url'],
        message: 'Valid badge image URL required',
      });
    }
  });

export const deleteSignatureAssetActionSchema = z.object({
  accountId: z.string().uuid(),
  assetId: z.string().uuid(),
});

export const updateStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  staffId: z.string().uuid(),
  full_name: emptyToNull,
  credentials: emptyToNull,
  job_title: emptyToNull,
  department: emptyToNull,
  phone_direct: emptyToNull,
  phone_mobile: emptyToNull,
  branch_id: z.string().uuid().nullable().optional(),
  signature_email: emptyToNull,
  photoDataUrl: z
    .string()
    .max(3_500_000, 'Photo is too large. Try a smaller image.')
    .optional()
    .nullable(),
  clearPhotoOverride: z.boolean().optional(),
  templateId: z.string().uuid().nullable().optional(),
});

const bulkStaffRowSchema = z.object({
  staffId: z.string().uuid(),
  full_name: emptyToNull,
  credentials: emptyToNull,
  job_title: emptyToNull,
  department: emptyToNull,
  phone_direct: emptyToNull,
  phone_mobile: emptyToNull,
  branch_id: z.string().uuid().nullable(),
  signature_email: emptyToNull,
  photoDataUrl: z
    .string()
    .max(3_500_000, 'Photo is too large. Try a smaller image.')
    .optional()
    .nullable(),
  templateId: z.string().uuid().nullable(),
});

export const bulkUpdateStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  rows: z.array(bulkStaffRowSchema).min(1).max(200),
});

export const saveTemplateActionSchema = z.object({
  accountId: z.string().uuid(),
  templateId: z.string().uuid(),
  name: z.string().trim().min(1, 'Template name is required').max(120),
  html_template: z.string().trim().min(1, 'HTML template is required'),
  is_default: z.boolean().default(false),
});

export const createIntegrationInviteActionSchema = z.object({
  accountId: z.string().uuid(),
  provider: z.enum(['microsoft', 'google']),
  label: z.string().trim().max(120).optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
});

export const revokeIntegrationInviteActionSchema = z.object({
  accountId: z.string().uuid(),
  inviteId: z.string().uuid(),
});

export const createSignaturePreviewShareActionSchema = z.object({
  accountId: z.string().uuid(),
  templateId: z.string().uuid(),
  staffId: z.string().uuid().nullable().optional(),
  /** `preview` hides install instructions; `install` shows the full page. */
  view: z.enum(['install', 'preview']).optional().default('install'),
});

export const sendSignatureInstallInstructionsActionSchema = z.object({
  accountId: z.string().uuid(),
  staffId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
});

export const updateSignatureChangeRequestStatusActionSchema = z.object({
  accountId: z.string().uuid(),
  requestId: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed']),
});

export const createManualStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().trim().email('Enter a valid email address'),
  full_name: z.string().trim().min(1, 'Name is required').max(200),
  credentials: emptyToNull,
  job_title: emptyToNull,
  department: emptyToNull,
  phone_direct: emptyToNull,
  phone_mobile: emptyToNull,
  photoDataUrl: z
    .string()
    .max(3_500_000, 'Photo is too large. Try a smaller image.')
    .optional()
    .nullable(),
});

export const deleteManualStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  staffId: z.string().uuid(),
});

export const STAFF_IMPORT_FIELD_KEYS = [
  'full_name',
  'first_name',
  'last_name',
  'email',
  'job_title',
  'department',
  'phone',
  'phone_direct',
  'mobile',
  'phone_mobile',
] as const;

export type StaffImportFieldKey = (typeof STAFF_IMPORT_FIELD_KEYS)[number];
export type StaffImportMappingValue = StaffImportFieldKey | '__skip__';

export const staffImportRowActionSchema = z.object({
  rowNumber: z.number().int().positive(),
  email: z.string().trim().email(),
  full_name: z.string().trim().min(1),
  job_title: emptyToNull,
  department: emptyToNull,
  phone_direct: emptyToNull,
  phone_mobile: emptyToNull,
  action: z.enum(['insert', 'update', 'skip']),
  existingStaffId: z.string().uuid().optional().nullable(),
});

export const importSignatureStaffActionSchema = z.object({
  accountId: z.string().uuid(),
  rows: z.array(staffImportRowActionSchema).min(1).max(1000),
});
