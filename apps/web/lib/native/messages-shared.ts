import { z } from 'zod';

export const NativeComposeTypeSchema = z.enum([
  'direct',
  'group',
  'job',
  'client',
]);

export const NativeCreateThreadBodySchema = z.object({
  workspace: z.string().min(1),
  type: NativeComposeTypeSchema,
  title: z.string().max(180).optional(),
  job_id: z
    .union([z.string().uuid(), z.literal('')])
    .nullable()
    .optional()
    .transform((value) => value || null),
  client_id: z.string().uuid().optional(),
  member_user_ids: z.array(z.string().uuid()).optional(),
  contact_ids: z.array(z.string().uuid()).optional(),
});

export const NativeIsoDateTimeSchema = z.string().datetime({ offset: true });

export const NativeSendMessageBodySchema = z.object({
  workspace: z.string().min(1),
  body: z.string().max(5000).optional().default(''),
  image_url: z
    .string()
    .url()
    .max(2048)
    .refine((value) => value.startsWith('https://'), {
      message: 'Image URL must use HTTPS',
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        type: z.enum(['note', 'doc']),
        id: z.string().uuid(),
        title: z.string().min(1).max(200),
      }),
    )
    .max(5)
    .optional(),
});
