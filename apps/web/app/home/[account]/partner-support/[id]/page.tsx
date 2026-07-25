import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import {
  countPartnerSupportLinks,
  getPartnerTicket,
  listPartnerTicketMessages,
} from '~/lib/support/partner-support.service';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { formatTicketNumber } from '../../support/_components/support-ticket-badges';
import { PartnerSupportDetailContent } from '../_components/partner-support-content';

interface PartnerSupportDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PartnerSupportDetailPageProps) {
  const { account, id } = await params;

  try {
    const workspace = await loadTeamWorkspace(account);
    const ticket = await getPartnerTicket(workspace.account.id, id);
    if (!ticket) return { title: 'Partner support' };

    return {
      title: `${formatTicketNumber(ticket.ticketNumber)} — ${ticket.title}`,
    };
  } catch {
    return { title: 'Partner support' };
  }
}

async function PartnerSupportDetailPage({
  params,
}: PartnerSupportDetailPageProps) {
  const { account: accountSlug, id: ticketId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const linkedAccountId = workspace.account.id;

  const linkCount = await countPartnerSupportLinks(linkedAccountId);
  if (linkCount === 0) {
    redirect(`/app/${accountSlug}`);
  }

  const [ticket, messages] = await Promise.all([
    getPartnerTicket(linkedAccountId, ticketId),
    listPartnerTicketMessages(linkedAccountId, ticketId),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`${formatTicketNumber(ticket.ticketNumber)} — ${ticket.title}`}
        description={`${ticket.providerAccountName} · Partner support`}
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <PartnerSupportDetailContent
          linkedAccountId={linkedAccountId}
          accountSlug={accountSlug}
          ticket={ticket}
          initialMessages={messages}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PartnerSupportDetailPage);
