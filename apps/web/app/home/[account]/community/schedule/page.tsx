import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { CommunityMemberNotesPanel } from '../_components/community-member-notes-panel';
import { CommunitySchedulePageContent } from '../_components/community-schedule-page-content';
import { CommunitySeriesPanel } from '../_components/community-series-panel';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { isAccountModuleEnabled } from '../../_lib/server/account-modules';
import {
  loadCommunityMemberNotes,
  loadCommunitySchedulePage,
} from '../_lib/server/community-schedule.loader';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';

interface CommunitySchedulePageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Schedule` };
};

async function CommunitySchedulePage({ params }: CommunitySchedulePageProps) {
  const { account: slug } = await params;
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

  const [schedule, memberNotes] = await Promise.all([
    loadCommunitySchedulePage(slug),
    loadCommunityMemberNotes(slug),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Schedule"
        description="Plan home group meetups, attach session content, and keep a record of each gathering."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-8 text-white lg:px-6">
        {schedule.accountId ? (
          <div className="mx-auto max-w-3xl space-y-10">
            <CommunitySeriesPanel
              accountSlug={slug}
              accountId={schedule.accountId}
              series={schedule.series}
            />
            <CommunitySchedulePageContent
              accountSlug={slug}
              accountId={schedule.accountId}
              upcoming={schedule.upcoming}
              past={schedule.past}
              series={schedule.series}
              templates={schedule.templates}
              members={schedule.members}
              tablesReady={schedule.tablesReady}
            />
            <CommunityMemberNotesPanel
              accountSlug={slug}
              accountId={schedule.accountId}
              notes={memberNotes.notes}
              members={memberNotes.members}
            />
          </div>
        ) : (
          <p className="text-sm text-white/60">Workspace not found.</p>
        )}
      </PageBody>
    </>
  );
}

export default withI18n(CommunitySchedulePage);
