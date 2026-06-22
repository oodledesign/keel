import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { PersonalNotesPageContent } from './_components/personal-notes-page-content';
import { loadPersonalNotesPageData } from './_lib/server/personal-notes.loader';

export const metadata = {
  title: 'Notes',
};

async function PersonalNotesPage() {
  const data = await loadPersonalNotesPageData();

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-white lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Notes</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Personal notes — saved as Markdown, private to your home.
        </p>
      </div>
      <PersonalNotesPageContent
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        notes={data.notes}
        tableAvailable={data.tableAvailable}
        customCategories={data.customCategories}
      />
    </PageBody>
  );
}

export default withI18n(PersonalNotesPage);
