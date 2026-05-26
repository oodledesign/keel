import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { CommunityMeetupDetailClient } from '../../_components/community-meetup-detail-client';
import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../../_lib/role-access';
import { isAccountModuleEnabled } from '../../../_lib/server/account-modules';
import { loadCommunityMeetupDetail } from '../../_lib/server/community-schedule.loader';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../../_lib/server/workspace-route-guard';

interface MeetupDetailPageProps {
  params: Promise<{ account: string; eventId: string }>;
}

async function CommunityMeetupDetailPage({ params }: MeetupDetailPageProps) {
  const { account: slug, eventId } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, ['community']);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isAccountModuleEnabled(workspace.moduleSettings, 'schedule')
  ) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const loaded = await loadCommunityMeetupDetail(slug, eventId);
  if (!loaded) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Meetup"
        description="Plan content, attendance, and post-meetup notes."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8 text-white lg:px-6">
        <div className="mx-auto max-w-3xl">
          <CommunityMeetupDetailClient
            accountSlug={slug}
            detail={loaded.detail}
            series={loaded.series}
          />
        </div>
      </PageBody>
    </>
  );
}

export default withI18n(CommunityMeetupDetailPage);
