import Link from 'next/link';
import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import pathsConfig from '~/config/paths.config';
import { getShareByIdForGuest } from '~/lib/clients/client-workspace-shares.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { listProjectsForShare } from '~/lib/projects/partner-projects.loader';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { SharedClientDetailContent } from '../_components/shared-client-detail-content';

export const generateMetadata = async () => ({ title: 'Shared client' });

async function SharedClientDetailPage({
  params,
}: {
  params: Promise<{ account: string; shareId: string }>;
}) {
  const { account: accountSlug, shareId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const share = await getShareByIdForGuest(workspace.account.id, shareId);

  if (!share) {
    notFound();
  }

  const projects = share.capabilities.canProjects
    ? await listProjectsForShare({
        guestAccountId: workspace.account.id,
        shareId,
      })
    : [];

  const name =
    share.clientDisplayName ?? share.clientOrgName ?? 'Shared client';

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={name}
        description={`Shared by ${share.ownerAccountName ?? 'partner'}`}
        account={accountSlug}
      />
      <PageBody>
        <div className="mb-4">
          <Link
            href={pathsConfig.app.accountSharedClients.replace(
              '[account]',
              accountSlug,
            )}
            className="text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--ozer-accent-muted)]"
          >
            ← All shared clients
          </Link>
        </div>
        <SharedClientDetailContent
          accountSlug={accountSlug}
          share={share}
          projects={projects}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SharedClientDetailPage);
