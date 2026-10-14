import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getIgUserProfile } from '../graph-api';
import type { IgContactRow } from '../types';

const FOLLOWER_CACHE_MS = 10 * 60 * 1000;

/**
 * Follow status via `is_user_follow_business` on the user profile. Meta sends
 * no follow webhook, so this is checked on demand and cached briefly.
 */
export async function getFollowerStatus(
  admin: SupabaseClient,
  params: {
    contact: IgContactRow;
    accessToken: string;
    force?: boolean;
  },
): Promise<{ isFollower: boolean | null; contact: IgContactRow }> {
  const { contact } = params;
  const checkedAt = contact.is_follower_checked_at
    ? Date.parse(contact.is_follower_checked_at)
    : 0;
  if (
    !params.force &&
    contact.is_follower !== null &&
    Date.now() - checkedAt < FOLLOWER_CACHE_MS
  ) {
    return { isFollower: contact.is_follower, contact };
  }

  try {
    const profile = await getIgUserProfile(contact.igsid, params.accessToken);
    const { data } = await admin
      .from('ig_contacts')
      .update({
        is_follower: profile.isUserFollowBusiness,
        is_follower_checked_at: new Date().toISOString(),
        username: profile.username ?? contact.username,
        display_name: profile.name ?? contact.display_name,
      })
      .eq('id', contact.id)
      .select('*')
      .single();
    return {
      isFollower: profile.isUserFollowBusiness,
      contact: (data as IgContactRow | null) ?? contact,
    };
  } catch {
    return { isFollower: contact.is_follower, contact };
  }
}
