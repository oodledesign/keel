import { z } from 'zod';

import { DEFAULT_SENDING_LOCAL_PARTS } from '~/lib/sending-domains';

const SENDING_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

export const AddSendingDomainSchema = z.object({
  accountId: z.string().uuid(),
  domain: z.string().min(1).max(253),
  sendingSubdomain: z
    .string()
    .max(63)
    .nullable()
    .optional()
    .refine(
      (value) =>
        value == null ||
        value.trim() === '' ||
        SENDING_SUBDOMAIN_RE.test(value.trim().toLowerCase()),
      'Use a simple subdomain such as mail, or choose apex.',
    ),
  localPart: z.enum(DEFAULT_SENDING_LOCAL_PARTS).optional(),
});

export const SendingDomainAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export const UpdateSendingLocalPartSchema = z.object({
  accountId: z.string().uuid(),
  localPart: z.enum(DEFAULT_SENDING_LOCAL_PARTS),
});

export type AddSendingDomainInput = z.infer<typeof AddSendingDomainSchema>;
export type UpdateSendingLocalPartInput = z.infer<
  typeof UpdateSendingLocalPartSchema
>;
