import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';

import { formatPortalDate } from '../_components/portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

interface PortalMeetingsPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Meetings' });

export default async function PortalMeetingsPage({
  params,
}: PortalMeetingsPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const meetings = await service.listPortalMeetings(ctx.clientOrgId);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Meetings
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Meeting notes your team has shared with you.
        </p>
      </div>

      {meetings.length === 0 ? (
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          No meetings have been shared yet.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {meetings.map((meeting) => (
            <Link
              key={meeting.id}
              href={pathsConfig.app.clientPortalMeetingDetail
                .replace('[clientSlug]', slug)
                .replace('[transcriptId]', meeting.id)}
            >
              <Card className="transition-colors hover:bg-[var(--workspace-shell-panel-hover)]">
                <CardHeader className="pb-2">
                  <CardTitle className="truncate text-base font-medium">
                    {meeting.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                    {meeting.meetingDate
                      ? formatPortalDate(meeting.meetingDate)
                      : 'Date not set'}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
