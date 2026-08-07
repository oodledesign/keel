import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalCreditsContent } from '../_components/portal-credits-content';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createPortalCreditsService } from '../_lib/server/portal-credits.service';

interface PortalCreditsPageProps {
  params: Promise<{ slug: string }>;
}

export const generateMetadata = async () => ({ title: 'Credits' });

export default async function PortalCreditsPage({
  params,
}: PortalCreditsPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const bundle = await createPortalCreditsService(
    getSupabaseServerClient(),
  ).getCreditsBundle(ctx.clientOrgId);

  return (
    <PortalCreditsContent
      clientOrgId={ctx.clientOrgId}
      clientSlug={slug}
      bundle={bundle}
    />
  );
}
