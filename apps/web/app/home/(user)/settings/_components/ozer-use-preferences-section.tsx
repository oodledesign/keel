import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { OzerUsePreferencesForm } from './ozer-use-preferences-form';

export async function OzerUsePreferencesSection() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('user_settings')
    .select('use_ozer_for_work, use_ozer_for_family, use_ozer_for_community')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <OzerUsePreferencesForm
      initial={{
        use_ozer_for_work: data?.use_ozer_for_work === true,
        use_ozer_for_family: data?.use_ozer_for_family === true,
        use_ozer_for_community: data?.use_ozer_for_community === true,
      }}
    />
  );
}
