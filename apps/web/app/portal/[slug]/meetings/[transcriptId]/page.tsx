import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArrowLeft } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { SharedMeetingNotesView } from '~/components/meetings/shared-meeting-notes-view';
import pathsConfig from '~/config/paths.config';

import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';
import { createClientPortalService } from '../../_lib/server/client-portal.service';

interface PortalMeetingDetailPageProps {
  params: Promise<{ slug: string; transcriptId: string }>;
}

export const generateMetadata = async () => ({ title: 'Meeting' });

export default async function PortalMeetingDetailPage({
  params,
}: PortalMeetingDetailPageProps) {
  const { slug, transcriptId } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const meeting = await service.getPortalMeeting(
    ctx.clientOrgId,
    transcriptId,
  );

  if (!meeting) {
    notFound();
  }

  const listHref = pathsConfig.app.clientPortalMeetings.replace(
    '[clientSlug]',
    slug,
  );

  return (
    <div className="space-y-4">
      <Link
        href={listHref}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ozer-text-on-light-muted)] transition-colors hover:text-[var(--ozer-accent)]"
      >
        <ArrowLeft className="h-4 w-4" />
        All meetings
      </Link>

      <SharedMeetingNotesView meeting={meeting} embedded footerNote={null} />
    </div>
  );
}
