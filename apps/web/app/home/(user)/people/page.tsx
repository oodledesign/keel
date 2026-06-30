import { Suspense } from 'react';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { PeoplePageClient } from './_components/people-page-client';
import { loadPeopleListPageData } from './_lib/server/people-page.loader';

export const metadata = { title: 'People' };

async function PeoplePageContent() {
  const data = await loadPeopleListPageData();
  return <PeoplePageClient people={data.people} viewer={data.viewer} />;
}

function PeoplePage() {
  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <Suspense
        fallback={
          <div className="px-4 text-sm text-[var(--workspace-shell-text-muted)] md:px-0">Loading…</div>
        }
      >
        <PeoplePageContent />
      </Suspense>
    </PageBody>
  );
}

export default withI18n(PeoplePage);
