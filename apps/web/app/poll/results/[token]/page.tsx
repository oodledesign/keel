import { notFound } from 'next/navigation';

import { PollResultsClient } from '../../_components/poll-results-client';
import { loadPublicPollResultsPage } from '../../_lib/server/public-poll-results.service';

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const page = await loadPublicPollResultsPage(token);
  return {
    title:
      page.status === 'ok'
        ? `Availability: ${page.title}`
        : 'Meeting availability',
    robots: { index: false, follow: false },
  };
}

export default async function PublicPollResultsPage({ params }: Props) {
  const { token } = await params;
  const page = await loadPublicPollResultsPage(token);
  if (page.status !== 'ok') {
    notFound();
  }

  return <PollResultsClient page={page} />;
}
