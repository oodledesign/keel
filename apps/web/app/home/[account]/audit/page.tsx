import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { listCommercialAccountEvents } from '~/lib/commercial/account-events';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../_lib/server/workspace-route-guard';
import { createListingsService } from '../listings/_lib/server/listings.service';
import { CommercialAuditFeed } from './_components/commercial-audit-feed';

interface AuditPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Audit' });

async function AuditPage({ params }: AuditPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);
  redirectIfSpaceNotIn(
    workspace,
    slug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id as string;
  const client = getSupabaseServerClient();
  const [events, members] = await Promise.all([
    listCommercialAccountEvents(client, { accountId, limit: 100 }),
    createListingsService(client).listAccountMembers(slug),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader account={slug} title="Audit" />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 pt-2 pb-6 lg:px-6">
        <div className="mb-4">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Workspace activity across disposals and contacts
          </p>
        </div>
        <CommercialAuditFeed
          accountSlug={slug}
          events={events}
          members={members.map((member) => ({
            userId: member.userId,
            name: member.name,
          }))}
        />
      </PageBody>
    </>
  );
}

export default withI18n(AuditPage);
