import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../_lib/role-access';
import { isAccountModuleEnabled } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../_lib/server/workspace-route-guard';
import { MemoriesPageClient } from './_components/memories-page-client';
import { isMemoryKind } from './_lib/memory-constants';
import { loadFamilyMemoriesPage } from './_lib/server/family-memories.loader';

interface FamilyMemoriesPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    child?: string;
    kind?: string;
    compose?: string;
  }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Memories` };
};

async function FamilyMemoriesPage({
  params,
  searchParams,
}: FamilyMemoriesPageProps) {
  const { account: slug } = await params;
  const { child, kind, compose } = await searchParams;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, ['family']);
  const accountAccess = workspace.account as {
    permissions?: string[] | null;
    role?: string | null;
    company_role?: string | null;
  };
  const access = getTeamAccountAccess(accountAccess);

  if (
    !access.canViewDashboard ||
    !isAccountModuleEnabled(workspace.moduleSettings, 'memories')
  ) {
    redirect(getDefaultAccountPath(slug, accountAccess));
  }

  const parsedKind = kind && isMemoryKind(kind) ? kind : null;
  const data = await loadFamilyMemoriesPage({
    accountSlug: slug,
    childId: child,
    kind: parsedKind,
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Memories"
        description="Little dated notes about the kids — quotes, firsts, and ordinary days."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-0 text-[var(--workspace-shell-text)] lg:px-0">
        <MemoriesPageClient
          data={data}
          initialChildId={child}
          initialKind={parsedKind}
          initialCompose={compose === '1'}
        />
      </PageBody>
    </>
  );
}

export default withI18n(FamilyMemoriesPage);
