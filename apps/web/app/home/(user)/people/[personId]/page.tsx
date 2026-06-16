import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { PersonProfileClient } from '../_components/person-profile-client';
import { loadPersonProfilePageData } from '../_lib/server/people-page.loader';

type Props = {
  params: Promise<{ personId: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { personId } = await params;
  const data = await loadPersonProfilePageData(personId);
  const name =
    data?.person.nickname?.trim() ||
    data?.person.full_name ||
    'Person';
  return { title: `${name} — People` };
}

async function PersonProfilePage({ params }: Props) {
  const { personId } = await params;
  const data = await loadPersonProfilePageData(personId);

  if (!data) {
    notFound();
  }

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <PersonProfileClient person={data.person} />
    </PageBody>
  );
}

export default withI18n(PersonProfilePage);
