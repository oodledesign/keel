import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { SupportTicketDetailContent } from '../_components/support-ticket-detail-content';
import { formatTicketNumber } from '../_components/support-ticket-badges';
import { loadSupportPageData } from '../_lib/server/support-page.loader';
import { createSupportTicketsService } from '../_lib/server/support-tickets.service';

interface SupportDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({ params }: SupportDetailPageProps) => {
  const { id } = await params;
  return { title: `Ticket ${id}` };
};

async function SupportDetailPage({ params }: SupportDetailPageProps) {
  const { account: accountSlug, id: ticketId } = await params;
  const workspace = await loadTeamWorkspace(accountSlug);
  const { accountId, canViewSupport } = await loadSupportPageData(accountSlug);

  if (!canViewSupport) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const service = createSupportTicketsService(getSupabaseServerClient());
  const [ticket, messages] = await Promise.all([
    service.getTicket({ accountId, ticketId }),
    service.listTicketMessages(accountId, ticketId),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={`${formatTicketNumber(ticket.ticketNumber)} — ${ticket.title}`}
        description="Support ticket details"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] p-4 md:p-6">
        <SupportTicketDetailContent
          ticket={ticket}
          initialMessages={messages}
          accountId={accountId}
          accountSlug={accountSlug}
        />
      </PageBody>
    </>
  );
}

export default withI18n(SupportDetailPage);
