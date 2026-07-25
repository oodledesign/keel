import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import {
  countPartnerSupportLinks,
  listPartnerTickets,
} from '~/lib/support/partner-support.service';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { PartnerSupportListContent } from './_components/partner-support-list-content';

interface PartnerSupportPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Partner support' });

async function PartnerSupportPage({ params }: PartnerSupportPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const linkedAccountId = workspace.account.id;

  const linkCount = await countPartnerSupportLinks(linkedAccountId);
  if (linkCount === 0) {
    redirect(`/app/${accountSlug}`);
  }

  const tickets = await listPartnerTickets(linkedAccountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Partner support"
        description="Tickets with agencies that linked this workspace"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <PartnerSupportListContent
          accountSlug={accountSlug}
          initialTickets={tickets}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PartnerSupportPage);
