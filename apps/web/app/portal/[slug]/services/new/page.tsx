import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { SupportDualPartyIdentity } from '~/components/support/support-party-identity';

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
  const [credits, projects, effectiveServices] = await Promise.all([
    creditsService.getCreditsBundle(ctx.clientOrgId),
    createClientPortalService(client).listProjects(
      ctx.clientOrgId,
      ctx.accountId,
    ),
    creditsService.listEffectiveServices(ctx.clientOrgId).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div>
        {(ctx.accountName || ctx.orgName) && (
          <SupportDualPartyIdentity
            className="mb-3"
            size="sm"
            business={
              ctx.accountName
                ? { name: ctx.accountName, logoUrl: ctx.accountLogoUrl }
                : null
            }
            client={
              ctx.orgName
                ? { name: ctx.orgName, logoUrl: ctx.clientPictureUrl }
                : null
            }
          />
        )}
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
        initialIntent={intent === 'service' ? 'service' : null}
      />
    </div>
  );
}
