import { notFound } from 'next/navigation';

import { PollVoteClient } from '../_components/poll-vote-client';
import { loadPublicPollPage } from '../_lib/server/public-poll.service';

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: Props) {
  const { token } = await params;
  const page = await loadPublicPollPage(token);
  if (page.status !== 'ok') {
    return { title: 'Meeting poll', robots: { index: false, follow: false } };
  }
  return {
    title: page.title,
    robots: { index: false, follow: false },
  };
}

export default async function PublicPollPage({ params }: Props) {
  const { token } = await params;
  const page = await loadPublicPollPage(token);
  if (page.status !== 'ok') {
    notFound();
  }

  return <PollVoteClient page={{ ...page, token }} />;
}
