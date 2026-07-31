import { Suspense } from 'react';

import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import featureFlagsConfig from '~/config/feature-flags.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import {
  linkPendingProjectGuestsForUser,
  listAcceptedGuestsForUser,
} from '~/lib/projects/project-guests.service';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { DashboardSkeleton } from './_components/dashboard/dashboard-skeleton';
import { DashboardWorkspaceBanner } from './_components/dashboard/dashboard-workspace-banner';
import { OzerDashboard } from './_components/dashboard/ozer-dashboard';
import { GuestProjectsHomeSection } from './_components/guest-projects-home-section';
import { loadUserWorkspace } from './_lib/server/load-user-workspace';
import { loadOzerDashboard } from './_lib/server/ozer-dashboard.loader';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('account:homePage');
  return { title };
};

async function DashboardContent() {
  const data = await loadOzerDashboard();
  return <OzerDashboard data={data} />;
}

async function UserHomePage() {
  const user = await requireUserInServerComponent();
  await linkPendingProjectGuestsForUser();

  const userWorkspace = await loadUserWorkspace();
  const teamCount = Array.isArray(userWorkspace.accounts)
    ? userWorkspace.accounts.length
    : 0;
  const showWorkspaceBanner =
    featureFlagsConfig.enableTeamAccounts &&
    teamCount === 0 &&
    featureFlagsConfig.enableTeamCreation;

  const guests = await listAcceptedGuestsForUser(user.id);
  // Guest-only users with a single shared project land on the board directly.
  if (teamCount === 0 && guests.length === 1) {
    redirect(
      pathsConfig.app.personalGuestProject.replace(
        '[projectId]',
        guests[0]!.projectId,
      ),
    );
  }

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)]">
      {showWorkspaceBanner ? (
        <DashboardWorkspaceBanner
          canCreateTeamAccount={userWorkspace.canCreateTeamAccount}
        />
      ) : null}
      {guests.length > 0 ? <GuestProjectsHomeSection guests={guests} /> : null}
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </PageBody>
  );
}

export default withI18n(UserHomePage);
