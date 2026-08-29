'use server';

import { headers } from 'next/headers';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { isRateLimited } from '~/lib/rate-limit/in-memory';

const PublicMatchesSettingsSchema = z.object({
  token: z.string().min(16).max(128),
  unsubscribed: z.boolean(),
  notifyOnNewMatch: z.boolean(),
});

export const updatePublicMatchSettings = enhanceAction(
  async (input) => {
    const headerStore = await headers();
    const forwarded = headerStore.get('x-forwarded-for');
    const ip =
      forwarded?.split(',')[0]?.trim() ||
      headerStore.get('x-real-ip')?.trim() ||
      'unknown';

    if (isRateLimited(`matches-settings:${input.token}:${ip}`, 20)) {
      throw new Error('Too many updates. Please try again shortly.');
    }

    const admin = getSupabaseServerAdminClient();
    const circulation = createCommercialCirculationService(admin);
    const preference = await circulation.loadPreferenceByPublicToken(
      input.token,
    );
    if (!preference) {
      throw new Error('This link is invalid or has expired.');
    }
    if (preference.marketingStatus === 'suppressed') {
      throw new Error('This address cannot be re-subscribed.');
    }

    await circulation.updatePublicPreference({
      accountId: preference.accountId,
      email: preference.email,
      unsubscribed: input.unsubscribed,
      notifyOnNewMatch: input.unsubscribed ? false : input.notifyOnNewMatch,
    });

    return { ok: true };
  },
  { auth: false, schema: PublicMatchesSettingsSchema },
);
