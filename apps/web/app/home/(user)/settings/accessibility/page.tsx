import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PersonalSettingsPanel } from '../_components/personal-settings-panel';
import { AccessibilitySettingsForm } from './_components/accessibility-settings-form';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: i18n.t('account:accessibilitySettings'),
  };
};

async function loadUserAccessibilitySettings(userId: string) {
  const client = getSupabaseServerClient();
  const { data } = await client
    .from('user_settings')
    .select(
      'accessibility_text_size, accessibility_high_contrast, accessibility_simplified_mode, accessibility_enhanced_focus, accessibility_dyslexia_font',
    )
    .eq('user_id', userId)
    .maybeSingle();

  return {
    accessibility_text_size: data?.accessibility_text_size ?? 'standard',
    accessibility_high_contrast: data?.accessibility_high_contrast ?? false,
    accessibility_simplified_mode: data?.accessibility_simplified_mode ?? true,
    accessibility_enhanced_focus: data?.accessibility_enhanced_focus ?? false,
    accessibility_dyslexia_font: data?.accessibility_dyslexia_font ?? false,
  };
}

async function AccessibilitySettingsPage() {
  const user = await requireUserInServerComponent();
  const initial = await loadUserAccessibilitySettings(user.id);

  return (
    <PersonalSettingsPanel
      title={<Trans i18nKey="account:accessibilitySettings" />}
      description={<Trans i18nKey="account:accessibilitySettingsDescription" />}
    >
      <AccessibilitySettingsForm initial={initial} />
    </PersonalSettingsPanel>
  );
}

export default withI18n(AccessibilitySettingsPage);
