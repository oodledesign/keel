import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalSupportListContent } from '../_components/portal-support-list-content';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';
import { loadPortalCreditsSnapshot } from '../_lib/server/portal-credits.loader';
import { createPortalCreditsService } from '../_lib/server/portal-credits.service';

interface PortalSupportPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ request?: string }>;
}

export const generateMetadata = async () => ({ title: 'Services' });

export default async function PortalSupportPage({
  params,
  searchParams,
}: PortalSupportPageProps) {
  const { slug } = await params;
  const { request } = await searchParams;
  const ctx = await loadClientPortalContext(slug);
  const client = getSupabaseServerClient();
  const portal = createClientPortalService(client);
  const creditsService = createPortalCreditsService(client);

  const [tickets, services, requestTypes, projects, snapshot, draft] =
    await Promise.all([
      portal.listTickets(ctx.clientOrgId),
      creditsService.listEffectiveServices(ctx.clientOrgId).catch(() => []),
      creditsService.listActiveRequestTypes(ctx.clientOrgId).catch(() => []),
      portal.listProjects(ctx.clientOrgId, ctx.accountId).catch(() => []),
      loadPortalCreditsSnapshot(ctx.clientOrgId),
      portal.getPortalRequestDraft(ctx.clientOrgId).catch(() => null),
    ]);

  return (
    <PortalSupportListContent
      clientSlug={slug}
      clientOrgId={ctx.clientOrgId}
      accountId={ctx.accountId}
      accountSlug={ctx.accountSlug}
      initialTickets={tickets}
      canRequest={services.length > 0}
      initialBalance={snapshot?.balance ?? 0}
      initialRequestTypes={requestTypes}
      initialEffectiveServices={services}
      initialProjects={projects}
      initialDraft={draft}
      initialRequest={request ?? null}
    />
  );
}
