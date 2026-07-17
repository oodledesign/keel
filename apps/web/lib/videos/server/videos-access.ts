import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { userIsAccountMember } from '~/lib/rankly/account-membership';

export async function requireVideoAccountAccess(accountId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { error: 'UNAUTHORIZED' as const, client, user: null };
  }

  const isMember = await userIsAccountMember(client, user.id, accountId);
  if (!isMember) {
    return { error: 'FORBIDDEN' as const, client, user };
  }

  return { error: null, client, user };
}

export async function requireVideoById(videoId: string) {
  const client = getSupabaseServerClient() as SupabaseClient;
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { error: 'UNAUTHORIZED' as const, client, user: null, video: null };
  }

  const { data: video, error } = await client
    .from('videos')
    .select('*')
    .eq('id', videoId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!video) {
    return { error: 'NOT_FOUND' as const, client, user, video: null };
  }

  const isMember = await userIsAccountMember(
    client,
    user.id,
    video.account_id as string,
  );

  if (!isMember) {
    return { error: 'FORBIDDEN' as const, client, user, video: null };
  }

  return { error: null, client, user, video };
}
