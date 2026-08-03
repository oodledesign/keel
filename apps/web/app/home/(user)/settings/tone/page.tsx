import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { ToneOfVoiceSettingsClient } from '~/components/voice/tone-of-voice-settings-client';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { loadPersonalVoicePageData } from '~/lib/voice/load-voice-profile-page';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('account:toneSettingsTitle', {
      defaultValue: 'Tone of voice',
    }),
  };
};

async function PersonalToneSettingsPage() {
  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const data = await loadPersonalVoicePageData(client, user.id);

  return (
    <ToneOfVoiceSettingsClient
      key={data.profile.updatedAt}
      scope={{ kind: 'personal' }}
      initial={data}
      canEdit
    />
  );
}

export default withI18n(PersonalToneSettingsPage);
