'use server';

import { redirect } from 'next/navigation';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { isUsableMailingListUnsubscribeToken } from '~/lib/campaigns/campaign-test-send';
import {
  resubscribeMailingListPublicPreference,
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
      throw new Error('This unsubscribe link is missing or invalid.');
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
      throw new Error('This unsubscribe link is missing or invalid.');
    }

    redirect(mailingListUnsubscribePath(token));
  },
  { auth: false },
);
