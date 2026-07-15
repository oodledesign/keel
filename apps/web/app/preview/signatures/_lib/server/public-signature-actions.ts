'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import { submitSignatureChangeRequest } from '~/lib/signatures/change-requests';

const SubmitChangeRequestSchema = z.object({
  token: z.string().min(16),
  message: z.string().trim().min(3).max(2000),
  fieldKeys: z.array(z.string().min(1)).min(1).max(12),
  requesterName: z.string().trim().max(120).optional().nullable(),
});

export const submitPublicSignatureChangeRequestAction = enhanceAction(
  async (input) => {
    return submitSignatureChangeRequest({
      token: input.token,
      message: input.message,
      fieldKeys: input.fieldKeys,
      requesterName: input.requesterName,
    });
  },
  { schema: SubmitChangeRequestSchema, auth: false },
);
