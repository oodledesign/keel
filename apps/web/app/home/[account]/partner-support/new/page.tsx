import { redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import {
  countPartnerSupportLinks,
  listPartnerLinkedOrgs,
} from '~/lib/support/partner-support.service';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { PartnerSupportNewForm } from '../_components/partner-support-content';

interface PartnerSupportNewPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Raise a ticket' });

async function PartnerSupportNewPage({ params }: PartnerSupportNewPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const linkedAccountId = workspace.account.id;

  const linkCount = await countPartnerSupportLinks(linkedAccountId);
  if (linkCount === 0) {
    redirect(`/app/${accountSlug}`);
  }

  const orgs = await listPartnerLinkedOrgs(linkedAccountId);
  if (orgs.length === 0) {
    redirect(`/app/${accountSlug}/partner-support`);
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Raise a ticket"
        description="Send a support request to your linked agency"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <PartnerSupportNewForm
          linkedAccountId={linkedAccountId}
          accountSlug={accountSlug}
          orgs={orgs}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PartnerSupportNewPage);
