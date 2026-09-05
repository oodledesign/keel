import { z } from 'zod';

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((value) => {
    const raw = value?.trim() ?? '';
    if (!raw) return '';
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  });

export const SaveBusinessCompanySchema = z.object({
  name: z.string().trim().min(1, 'Company name is required').max(120),
  website: optionalUrl,
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
});

export const SaveBusinessClientSchema = z.object({
  accountId: z.string().uuid(),
  companyName: z.string().trim().min(1, 'Client name is required').max(160),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z
    .string()
    .trim()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
  website: optionalUrl,
  enablePortal: z.boolean().optional().default(false),
});

export const SaveBusinessTaskSchema = z.object({
  accountId: z.string().uuid(),
  clientId: z.string().uuid().optional(),
  title: z.string().trim().min(1, 'Task title is required').max(200),
  notes: z.string().trim().max(4000).optional(),
});

export const SkipBusinessTaskSchema = z.object({
  accountId: z.string().uuid(),
});

export const ContinueBusinessAssistantSchema = z.object({
  accountId: z.string().uuid(),
});

export const CompleteBusinessLiteSchema = z.object({
  accountId: z.string().uuid(),
});

export const StartBusinessPaidPlanSchema = z.object({
  accountId: z.string().uuid(),
  productId: z.enum(['ozer-business-starter', 'ozer-business']),
  seats: z.coerce.number().int().min(1).max(200),
});

export type SaveBusinessCompanyInput = z.infer<typeof SaveBusinessCompanySchema>;
export type SaveBusinessClientInput = z.infer<typeof SaveBusinessClientSchema>;
export type SaveBusinessTaskInput = z.infer<typeof SaveBusinessTaskSchema>;
export type StartBusinessPaidPlanInput = z.infer<
  typeof StartBusinessPaidPlanSchema
>;
