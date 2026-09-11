import { z } from 'zod';

import { composeContactFullName } from '~/lib/clients/contact-roles';

export const ExtensionCaptureKinds = ['task', 'note', 'contact'] as const;

export const ExtensionCaptureSchema = z
  .object({
    kind: z.enum(ExtensionCaptureKinds),
    account_id: z.string().uuid().optional(),
    title: z.string().trim().max(200).optional(),
    body: z.string().trim().max(20_000).optional(),
    url: z.string().url().max(2000).optional(),
    page_title: z.string().trim().max(300).optional(),
    email: z.string().email().optional(),
    phone: z.string().trim().max(40).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind === 'task' && !data.title?.trim() && !data.body?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A task needs a title or selected text',
        path: ['title'],
      });
    }
    if (data.kind === 'note' && !data.body?.trim() && !data.title?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A note needs a title or body',
        path: ['body'],
      });
    }
    if (data.kind === 'contact') {
      const name = composeContactFullName({
        fullName: data.title,
        firstName: data.title,
      });
      if (!name) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'A contact stub needs a name',
          path: ['title'],
        });
      }
    }
  });

export type ExtensionCaptureInput = z.infer<typeof ExtensionCaptureSchema>;
