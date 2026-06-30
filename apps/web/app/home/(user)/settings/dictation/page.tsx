import Link from 'next/link';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { listDictationHistory } from '~/lib/recorder/dictation-history';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

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
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 text-[var(--workspace-shell-text)] lg:px-6">
      <div className="flex w-full flex-1 flex-col lg:max-w-2xl">
        <div className="mb-4">
          <Link
            href={pathsConfig.app.personalAccountSettings}
            className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          >
            ← Back to settings
          </Link>
        </div>

        <div className="rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-6 shadow-[0_18px_50px_rgba(4,10,24,0.24)]">
          <h1 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Dictation history
          </h1>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Snippets from Keel Assistant global dictation. Your current session also
            shows recent items in the menu bar popover.
          </p>

          {items.length === 0 ? (
            <p className="mt-6 text-sm text-[var(--workspace-shell-text-muted)]">
              No dictation saved yet. Use the dictation hotkey in Keel Assistant while
              signed in.
            </p>
          ) : (
            <ul className="mt-6 flex flex-col gap-3">
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
        </div>
      </div>
    </PageBody>
  );
}

export default withI18n(PersonalDictationHistoryPage);
