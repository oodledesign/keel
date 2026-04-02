import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { KeelUsePreferencesForm } from './keel-use-preferences-form';

export async function KeelUsePreferencesSection() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('user_settings')
    .select(
      'use_keel_for_work, use_keel_for_family, use_keel_for_community',
    )
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <KeelUsePreferencesForm
      initial={{
        use_keel_for_work: data?.use_keel_for_work === true,
        use_keel_for_family: data?.use_keel_for_family === true,
        use_keel_for_community: data?.use_keel_for_community === true,
      }}
    />
  );
}
