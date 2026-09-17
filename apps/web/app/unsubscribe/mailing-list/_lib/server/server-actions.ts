'use server';

import { redirect } from 'next/navigation';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isUsableMailingListUnsubscribeToken } from '~/lib/campaigns/campaign-test-send';
import {
  PUBLIC_MAILING_PREFERENCE_INVALID_LINK,
  resubscribeMailingListPublicPreference,
  setMailingListPublicListPreference,
  unsubscribeMailingListPublicPreference,
} from '~/lib/workspace-forms/mailing-list-public-preference';

const MailingListPreferenceTokenSchema = z.object({
  token: z
    .string()
    .min(16)
    .max(64)
    .refine((value) => isUsableMailingListUnsubscribeToken(value), {
      message: 'This is a test email — unsubscribe is disabled.',
    }),
});

function parseToken(formData: FormData) {
  return MailingListPreferenceTokenSchema.parse({
    token: String(formData.get('token') ?? ''),
  }).token;
}

function mailingListUnsubscribePath(token: string, subscribed?: boolean) {
  const params = new URLSearchParams({ token });
  if (subscribed) params.set('status', 'subscribed');
  return `/unsubscribe/mailing-list?${params.toString()}`;
}

export const resubscribeMailingListAction = enhanceAction(
  async (formData: FormData) => {
    const token = parseToken(formData);
    const admin = getSupabaseServerAdminClient();
    const result = await resubscribeMailingListPublicPreference(admin, token);

    if (!result || result.marketingStatus !== 'subscribed') {
      throw new Error(PUBLIC_MAILING_PREFERENCE_INVALID_LINK);
    }

    redirect(mailingListUnsubscribePath(token, true));
  },
  { auth: false },
);

export const unsubscribeMailingListAction = enhanceAction(
  async (formData: FormData) => {
    const token = parseToken(formData);
    const admin = getSupabaseServerAdminClient();
    const result = await unsubscribeMailingListPublicPreference(admin, token);

    if (!result) {
      throw new Error(PUBLIC_MAILING_PREFERENCE_INVALID_LINK);
    }

    redirect(mailingListUnsubscribePath(token));
  },
  { auth: false },
);

const MailingListPublicListSchema = MailingListPreferenceTokenSchema.extend({
  listId: z.string().uuid(),
  subscribed: z.boolean(),
});

export const setMailingListPublicListAction = enhanceAction(
  async (data) => {
    const admin = getSupabaseServerAdminClient();
    const result = await setMailingListPublicListPreference(
      admin,
      data.token,
      data.listId,
      data.subscribed,
    );

    if (!result) {
      throw new Error(PUBLIC_MAILING_PREFERENCE_INVALID_LINK);
    }

    redirect(
      mailingListUnsubscribePath(
        data.token,
        result.marketingStatus === 'subscribed',
      ),
    );
  },
  { auth: false, schema: MailingListPublicListSchema },
);
