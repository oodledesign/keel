'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ignoreEmailThreadNeedsReply } from '~/lib/email-assistant/ignore-thread-needs-reply';
import { z } from 'zod';

const IgnoreEmailNeedsReplySchema = z.object({
  threadId: z.string().uuid(),
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).optional(),
});

export const ignoreEmailNeedsReplyAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    await ignoreEmailThreadNeedsReply(
      client,
      user.id,
      data.threadId,
      data.accountId,
    );

    revalidatePath('/home/email');
    revalidatePath('/app/email');
    if (data.accountSlug) {
      revalidatePath(`/home/${data.accountSlug}`);
      revalidatePath(`/app/${data.accountSlug}`);
      revalidatePath(`/home/${data.accountSlug}/email`);
      revalidatePath(`/app/${data.accountSlug}/email`);
    }

    return { ok: true as const };
  },
  {
    auth: true,
    schema: IgnoreEmailNeedsReplySchema,
  },
);
