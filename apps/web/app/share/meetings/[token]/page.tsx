import { notFound } from 'next/navigation';

import { SharedMeetingNotesView } from '~/components/meetings/shared-meeting-notes-view';
import { withI18n } from '~/lib/i18n/with-i18n';
import { loadPublicMeetingByToken } from '~/lib/recorder/public-meeting.loader';

interface PublicMeetingPageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PublicMeetingPageProps) {
  const { token } = await params;
  const meeting = await loadPublicMeetingByToken(token);

  if (!meeting) {
    return {
      title: 'Meeting not found',
      robots: { index: false, follow: false },
    };
  }

  return {
    title: meeting.title,
    description: meeting.summaryText
      ? meeting.summaryText.replace(/[#*_`]/g, '').slice(0, 160)
      : `Meeting notes for ${meeting.title}`,
    robots: { index: false, follow: false },
  };
}

async function PublicMeetingPage({ params }: PublicMeetingPageProps) {
  const { token } = await params;
  const meeting = await loadPublicMeetingByToken(token);

  if (!meeting) {
    notFound();
  }

  return <SharedMeetingNotesView meeting={meeting} />;
}

export default withI18n(PublicMeetingPage);
