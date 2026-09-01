import { z } from 'zod';

import { DEFAULT_SENDING_LOCAL_PARTS } from '~/lib/sending-domains';

export const AddSendingDomainSchema = z.object({
  accountId: z.string().uuid(),
  domain: z.string().min(1).max(253),
  sendingSubdomain: z.string().max(63).nullable().optional(),
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
