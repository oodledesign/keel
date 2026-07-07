import { listDictationHistory } from '~/lib/recorder/dictation-history';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { PersonalSettingsPanel } from '../_components/personal-settings-panel';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return {
    title: i18n.t('account:dictationHistoryTitle', { defaultValue: 'Dictation history' }),
  };
};

async function PersonalDictationHistoryPage() {
  const user = await requireUserInServerComponent();
  const items = await listDictationHistory({ userId: user.id, limit: 100 });

  return (
    <PersonalSettingsPanel
      title="Dictation history"
      description="Snippets from Keel Assistant global dictation. Your current session also shows recent items in the menu bar popover."
    >
      {items.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No dictation saved yet. Use the dictation hotkey in Keel Assistant while
          signed in.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-white/3 px-4 py-3"
            >
              <p className="whitespace-pre-wrap text-sm text-[var(--workspace-shell-text)]">
                {item.text}
              </p>
              <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
                {new Date(item.created_at).toLocaleString()}
                {item.paste_mode ? ' · pasted at cursor' : ' · copy panel'}
              </p>
            </li>
          ))}
        </ul>
      )}
    </PersonalSettingsPanel>
  );
}

export default withI18n(PersonalDictationHistoryPage);
