import Link from 'next/link';
import { notFound } from 'next/navigation';

import { Button } from '@kit/ui/button';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';
import { loadUserPlatformSupportTicket } from '~/lib/support/load-platform-support-ticket';
import { replyPlatformSupportTicketAction } from '~/lib/support/platform-support.actions';

import { HomeLayoutPageHeader } from '../../_components/home-page-header';
import {
  PlatformSupportReplyForm,
  PlatformSupportTicketThread,
} from '../_components/platform-support-ticket-detail';

export const metadata = { title: 'Support ticket' };

interface PlatformSupportTicketPageProps {
  params: Promise<{ id: string }>;
}

async function PlatformSupportTicketPage({
  params,
}: PlatformSupportTicketPageProps) {
  const { id } = await params;
  const user = await requireUserInServerComponent();
  const ticket = await loadUserPlatformSupportTicket(id, user.id);

  if (!ticket) {
    notFound();
  }

  const closed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <>
      <HomeLayoutPageHeader
        title="Support"
        description={
          <Button asChild variant="link" className="h-auto p-0">
            <Link href="/app/support">← All tickets</Link>
          </Button>
        }
      />
      <PageBody className="mx-auto max-w-2xl space-y-8 py-6">
        <PlatformSupportTicketThread
          ticketNumber={ticket.ticketNumber}
          subject={ticket.subject}
          openingBody={ticket.body}
          createdAt={ticket.createdAt}
          status={ticket.status}
          messages={ticket.messages}
          userEmail={ticket.userEmail}
          accountName={ticket.accountName}
        />

        {!closed ? (
          <PlatformSupportReplyForm
            ticketId={ticket.id}
            placeholder="Add a follow-up message…"
            onSubmit={replyPlatformSupportTicketAction}
          />
        ) : (
          <p className="text-muted-foreground text-sm">
            This ticket is {ticket.status}. Open a new ticket if you need more
            help.
          </p>
        )}
      </PageBody>
    </>
  );
}

export default withI18n(PlatformSupportTicketPage);
