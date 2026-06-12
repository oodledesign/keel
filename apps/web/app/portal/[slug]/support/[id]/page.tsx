import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalSupportDetailContent } from '../../_components/portal-support-content';
import { formatPortalTicketNumber } from '../../_components/portal-badges';
import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';
import { createClientPortalService } from '../../_lib/server/client-portal.service';

interface PortalSupportDetailPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PortalSupportDetailPageProps) {
  const { slug, id } = await params;

  try {
    const ctx = await loadClientPortalContext(slug);
    const service = createClientPortalService(getSupabaseServerClient());
    const ticket = await service.getTicket(ctx.clientOrgId, id);

    if (!ticket) return { title: 'Support ticket' };

    return {
      title: `${formatPortalTicketNumber(ticket.ticketNumber)} — ${ticket.title}`,
    };
  } catch {
    return { title: 'Support ticket' };
  }
}

export default async function PortalSupportDetailPage({
  params,
}: PortalSupportDetailPageProps) {
  const { slug, id } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());

  const [ticket, messages] = await Promise.all([
    service.getTicket(ctx.clientOrgId, id),
    service.listTicketMessages(ctx.clientOrgId, id),
  ]);

  if (!ticket) {
    notFound();
  }

  return (
    <PortalSupportDetailContent
      ticket={ticket}
      initialMessages={messages}
      clientOrgId={ctx.clientOrgId}
      clientSlug={slug}
    />
  );
}
