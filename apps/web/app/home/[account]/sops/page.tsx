import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { isWorkNavModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { SopsLibraryPage } from './_components/sops-library-page';
import {
  assertSopsSchemaAvailable,
  loadSopsLibraryPage,
} from './_lib/server/sops-data';

interface SopsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'SOPs',
});

async function SopsPage({ params }: SopsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  redirectIfSpaceNotIn(workspace, accountSlug, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (
    !access.canViewDashboard ||
    !isWorkNavModuleEnabled(workspace.moduleSettings, 'sops')
  ) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const schemaOk = await assertSopsSchemaAvailable();
  if (!schemaOk) {
    return (
      <>
        <TeamAccountLayoutPageHeader
          account={accountSlug}
          title="SOPs"
          description="Standard operating procedures for your team."
        />
        <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-8">
          <p className="text-sm text-amber-200/90">
            SOPs module is not available on this database yet. Apply the latest
            Supabase migrations and add the <code className="text-xs">sops</code>{' '}
            schema to PostgREST exposed schemas.
          </p>
        </PageBody>
      </>
    );
  }

  const data = await loadSopsLibraryPage(accountSlug);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="SOPs"
        description="Repeatable processes and checklists for your team."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] p-0">
        <SopsLibraryPage
          accountSlug={data.accountSlug}
          playbooks={data.playbooks}
          recentRuns={data.recentRuns}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SopsPage);
