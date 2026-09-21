import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalSupportListContent } from '../_components/portal-support-list-content';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';
import { loadPortalCanRequestService } from '../_lib/server/portal-credits.loader';

interface PortalSupportPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Services' });

export default async function PortalSupportPage({
  params,
}: PortalSupportPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const [tickets, canRequest] = await Promise.all([
    service.listTickets(ctx.clientOrgId),
    loadPortalCanRequestService(ctx.clientOrgId),
  ]);

  return (
    <PortalSupportListContent
      clientSlug={slug}
      initialTickets={tickets}
      canRequest={canRequest}
      clientName={ctx.orgName}
      clientPictureUrl={ctx.clientPictureUrl}
      businessName={ctx.accountName}
      businessLogoUrl={ctx.accountLogoUrl}
    />
  );
}
