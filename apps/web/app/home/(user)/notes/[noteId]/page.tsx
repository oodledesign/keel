import { withI18n } from '~/lib/i18n/with-i18n';

import { NoteEditor } from '~/home/[account]/notes/_components/note-editor';
import { loadPersonalNoteDetailData } from '../_lib/server/personal-notes.loader';

import pathsConfig from '~/config/paths.config';

interface PersonalNoteDetailPageProps {
  params: Promise<{ noteId: string }>;
}

export const generateMetadata = async () => ({
  title: 'Edit note',
});

async function PersonalNoteDetailPage({ params }: PersonalNoteDetailPageProps) {
  const { noteId } = await params;
  const data = await loadPersonalNoteDetailData(noteId);

  return (
    <div className="w-full bg-[var(--workspace-shell-canvas)] px-4 text-white sm:px-6 lg:px-10 xl:px-14">
      <NoteEditor
        accountId={data.accountId}
        accountSlug={data.accountSlug}
        linkOptions={[]}
        customCategories={data.customCategories}
        notesListHref={pathsConfig.app.personalNotes}
        personalScope
        note={data.note}
      />
    </div>
  );
}

export default withI18n(PersonalNoteDetailPage);
