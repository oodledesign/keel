import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import type { Database } from '~/lib/database.types';

import { clearReferralCookies, readReferralCookies } from './referral-cookies';
import { ensureUserReferralCode } from './ensure-referral-code';

type AdminClient = SupabaseClient<Database>;

export async function attributeReferralAtSignup(params: {
  referredUserId: string;
  admin?: AdminClient;
}): Promise<void> {
  const logger = await getLogger();
  const admin = params.admin ?? getSupabaseServerAdminClient();

  await ensureUserReferralCode(admin, params.referredUserId);

  const { code, utmSource } = await readReferralCookies();

  if (!code) {
    return;
  }

  const { data: referrerSettings } = await admin
    .from('user_settings')
    .select('user_id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrerSettings?.user_id) {
    await clearReferralCookies();
    return;
  }

  if (referrerSettings.user_id === params.referredUserId) {
    await clearReferralCookies();
    return;
  }

  const { data: existingReferral } = await admin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', params.referredUserId)
    .maybeSingle();

  if (existingReferral) {
    await clearReferralCookies();
    return;
  }

  const { data: latestClick } = await admin
    .from('referral_clicks')
    .select('id')
    .eq('referral_code', code)
    .is('converted_referred_user_id', null)
    .order('clicked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error: insertError } = await admin.from('referrals').insert({
    referrer_user_id: referrerSettings.user_id,
    referred_user_id: params.referredUserId,
    status: 'pending',
    utm_source: utmSource ?? 'direct',
    referral_click_id: latestClick?.id ?? null,
  });

  if (insertError) {
    logger.warn(
      { error: insertError, referredUserId: params.referredUserId },
      '[rewards] referral attribution failed',
    );
    return;
  }

  if (latestClick?.id) {
    await admin
      .from('referral_clicks')
      .update({ converted_referred_user_id: params.referredUserId })
      .eq('id', latestClick.id);
  }

  await clearReferralCookies();
}
