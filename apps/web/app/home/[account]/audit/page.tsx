import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { ProjectAuditFeed } from '~/components/projects/project-audit-feed';
import { listCommercialAccountEvents } from '~/lib/commercial/account-events';
import { withI18n } from '~/lib/i18n/with-i18n';
import { listProjectAuditLog } from '~/lib/projects/project-audit.service';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getSpaceTypeFromAccount } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { createListingsService } from '../listings/_lib/server/listings.service';
import { CommercialAuditFeed } from './_components/commercial-audit-feed';

interface AuditPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Audit log' });

async function AuditPage({ params }: AuditPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(workspace, slug, [
    ...COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
    ...BUSINESS_WORKSPACE_SPACE_TYPES,
  ]);

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

  const isCommercial = spaceType === 'commercial-property';

  const [commercialData, projectAuditEvents] = await Promise.all([
    isCommercial
      ? Promise.all([
          listCommercialAccountEvents(client, { accountId, limit: 100 }),
          createListingsService(client).listAccountMembers(slug),
        ])
      : Promise.resolve([[], []]),
    !isCommercial
      ? listProjectAuditLog(client, { accountId, limit: 40 })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Audit log" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <div className="mb-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            {isCommercial
              ? 'Workspace activity across disposals and contacts'
              : 'Audit log of changes made to projects, tasks, phases, canvas notes, and guest access'}
          </p>
        </div>

        {isCommercial ? (
          <CommercialAuditFeed
            accountSlug={slug}
            events={commercialData[0]}
            members={commercialData[1].map((member) => ({
              userId: member.userId,
              name: member.name,
            }))}
          />
        ) : (
          <ProjectAuditFeed
            accountId={accountId}
            accountSlug={slug}
            initialEvents={projectAuditEvents}
            showProjectLink
          />
        )}
      </PageBody>
    </>
  );
}

export default withI18n(AuditPage);
