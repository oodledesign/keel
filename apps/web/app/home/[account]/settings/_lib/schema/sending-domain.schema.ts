import { z } from 'zod';

import { normalizeSendingLocalPart } from '~/lib/sending-domains';

const SENDING_SUBDOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

function isSendingLocalPart(value: string) {
  try {
    normalizeSendingLocalPart(value);
    return true;
  } catch {
    return false;
  }
}

const sendingLocalPartSchema = z
  .string()
  .min(1)
  .max(64)
  .refine(
    isSendingLocalPart,
    'Use a simple From name such as mail, listings, hello, or no-reply.',
  );

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
      'Use a simple subdomain such as mail, go, or agency — or choose apex.',
    ),
  localPart: sendingLocalPartSchema.optional(),
});

export const SendingDomainAccountSchema = z.object({
  accountId: z.string().uuid(),
});

export const UpdateSendingLocalPartSchema = z.object({
  accountId: z.string().uuid(),
  localPart: sendingLocalPartSchema,
});

export type AddSendingDomainInput = z.infer<typeof AddSendingDomainSchema>;
export type UpdateSendingLocalPartInput = z.infer<
  typeof UpdateSendingLocalPartSchema
>;
