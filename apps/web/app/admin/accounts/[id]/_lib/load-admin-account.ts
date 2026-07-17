import 'server-only';

import { cache } from 'react';

import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type AdminAccountRecord = {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  is_personal_account: boolean;
  picture_url: string | null;
  primary_owner_user_id: string;
  created_at: string | null;
  updated_at: string | null;
};

export const loadAdminAccount = cache(
  async (id: string): Promise<AdminAccountRecord> => {
    const admin = getSupabaseServerAdminClient();

    const { data: byId, error: byIdError } = await admin
      .from('accounts')
      .select(
        'id, name, slug, email, is_personal_account, picture_url, primary_owner_user_id, created_at, updated_at',
      )
      .eq('id', id)
      .maybeSingle();

    if (byIdError) {
      console.error('[admin-account] lookup by id failed:', byIdError.message);
      throw byIdError;
    }

    if (byId) {
      return byId as AdminAccountRecord;
    }

    const { data: byOwner, error: byOwnerError } = await admin
      .from('accounts')
      .select(
        'id, name, slug, email, is_personal_account, picture_url, primary_owner_user_id, created_at, updated_at',
      )
      .eq('primary_owner_user_id', id)
      .eq('is_personal_account', true)
      .maybeSingle();

    if (byOwnerError) {
      console.error(
        '[admin-account] lookup by owner failed:',
        byOwnerError.message,
      );
      throw byOwnerError;
    }

    if (!byOwner) {
      notFound();
    }

    return byOwner as AdminAccountRecord;
  },
);
