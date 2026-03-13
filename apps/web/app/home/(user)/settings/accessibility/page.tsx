import { PageBody } from '@kit/ui/page';
import { Trans } from '@kit/ui/trans';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

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
    .select('accessibility_text_size, accessibility_high_contrast, accessibility_simplified_mode, accessibility_enhanced_focus, accessibility_dyslexia_font')
    .eq('user_id', userId)
    .maybeSingle();

  return {
    accessibility_text_size: data?.accessibility_text_size ?? 'standard',
    accessibility_high_contrast: data?.accessibility_high_contrast ?? false,
    accessibility_simplified_mode: data?.accessibility_simplified_mode ?? true,
    accessibility_enhanced_focus: data?.accessibility_enhanced_focus ?? true,
    accessibility_dyslexia_font: data?.accessibility_dyslexia_font ?? false,
  };
}

async function AccessibilitySettingsPage() {
  const user = await requireUserInServerComponent();
  const initial = await loadUserAccessibilitySettings(user.id);

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <div className="flex w-full flex-1 flex-col lg:max-w-2xl">
        <div className="rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
              <Trans i18nKey="account:accessibilitySettings" />
            </h2>
            <p className="mt-1 text-sm text-zinc-400">
              <Trans i18nKey="account:accessibilitySettingsDescription" />
            </p>
          </div>
          <AccessibilitySettingsForm initial={initial} />
        </div>
      </div>
    </PageBody>
  );
}

export default withI18n(AccessibilitySettingsPage);
