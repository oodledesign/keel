import { notFound } from 'next/navigation';

import { loadPublicSupportTicketByToken } from '~/lib/support/public-support.service';

import { PublicSupportTicketThread } from './_components/public-support-ticket-thread';

export const metadata = {
  title: 'Support ticket',
  robots: { index: false, follow: false },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function PublicSupportTicketPage({ params }: PageProps) {
  const { token } = await params;
  const ticket = await loadPublicSupportTicketByToken(token);

  if (!ticket) {
    notFound();
  }

  return (
    <main className="min-h-svh bg-zinc-50 text-zinc-900">
      <PublicSupportTicketThread
        token={token}
        ticketNumber={ticket.ticketNumber}
        title={ticket.title}
        status={ticket.status}
        projectName={ticket.projectName}
        recordingUrl={ticket.recordingUrl}
        externalUrl={ticket.externalUrl}
        submitterName={ticket.submitterName}
        submitterEmail={ticket.submitterEmail}
        workspaceName={ticket.accountName}
        workspaceLogoUrl={ticket.accountLogoUrl}
        clientName={ticket.clientOrgName}
        clientPictureUrl={ticket.clientPictureUrl}
        messages={ticket.messages}
        closed={ticket.status === 'closed'}
      />
    </main>
  );
}
