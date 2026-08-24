import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';

type AdminClient = SupabaseClient<Database>;

const CODE_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';

function randomReferralCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function ensureUserReferralCode(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data: existing } = await client
    .from('user_settings')
    .select('referral_code')
    .eq('user_id', userId)
    .maybeSingle();

  if (existing?.referral_code) {
    return existing.referral_code;
  }

  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomReferralCode();
    const { data: conflict } = await client
      .from('user_settings')
      .select('user_id')
      .eq('referral_code', code)
      .maybeSingle();

    if (conflict) continue;

    const { data: upserted, error } = await client
      .from('user_settings')
      .upsert(
        {
          user_id: userId,
          referral_code: code,
        },
        { onConflict: 'user_id' },
      )
      .select('referral_code')
      .maybeSingle();

    if (!error && upserted?.referral_code) {
      return upserted.referral_code;
    }

    const { data: raced } = await client
      .from('user_settings')
      .select('referral_code')
      .eq('user_id', userId)
      .maybeSingle();

    if (raced?.referral_code) {
      return raced.referral_code;
    }
  }

  throw new Error('Failed to generate referral code');
}

export async function ensureUserReferralCodeAsUser(
  client: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data, error } = await client.rpc('ensure_user_referral_code', {
    p_user_id: userId,
  });

  if (!error && typeof data === 'string' && data.length > 0) {
    return data;
  }

  return ensureUserReferralCode(client, userId);
}

export type { AdminClient };
