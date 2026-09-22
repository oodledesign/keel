import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalSupportNewForm } from '../../_components/portal-support-content';
import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';
import { createClientPortalService } from '../../_lib/server/client-portal.service';
import { createPortalCreditsService } from '../../_lib/server/portal-credits.service';

interface PortalSupportNewPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ intent?: string }>;
}

export const generateMetadata = async () => ({ title: 'New request' });

export default async function PortalServicesNewPage({
  params,
  searchParams,
}: PortalSupportNewPageProps) {
  const { slug } = await params;
  const { intent } = await searchParams;
  const ctx = await loadClientPortalContext(slug);
  const client = getSupabaseServerClient();
  const creditsService = createPortalCreditsService(client);
  const portal = createClientPortalService(client);
  const [credits, projects, effectiveServices, draft] = await Promise.all([
    creditsService.getCreditsBundle(ctx.clientOrgId),
    portal.listProjects(ctx.clientOrgId, ctx.accountId),
    creditsService.listEffectiveServices(ctx.clientOrgId).catch(() => []),
    portal.getPortalRequestDraft(ctx.clientOrgId).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          New request
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Choose a service or open a support ticket — we&apos;ll walk you
          through the rest.
        </p>
      </div>

      <PortalSupportNewForm
        clientOrgId={ctx.clientOrgId}
        accountId={ctx.accountId}
        accountSlug={ctx.accountSlug}
        clientSlug={slug}
        initialBalance={credits.balance}
        initialRequestTypes={credits.requestTypes}
        initialEffectiveServices={effectiveServices}
        initialProjects={projects}
        initialIntent={draft ? null : intent === 'service' ? 'service' : null}
        initialDraft={draft}
      />
    </div>
  );
}
