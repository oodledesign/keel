import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalSupportListContent } from '../_components/portal-support-list-content';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

interface PortalSupportPageProps {
  params: Promise<{ clientSlug: string }>;
}

export const generateMetadata = async () => ({ title: 'Support' });

export default async function PortalSupportPage({
  params,
}: PortalSupportPageProps) {
  const { clientSlug } = await params;
  const ctx = await loadClientPortalContext(clientSlug);
  const service = createClientPortalService(getSupabaseServerClient());
  const tickets = await service.listTickets(ctx.clientOrgId);

  return (
    <PortalSupportListContent
      clientSlug={clientSlug}
      initialTickets={tickets}
    />
  );
}
