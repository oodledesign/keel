import { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getAgencyBrandingBySlug } from '~/lib/agency-branding';
import { isAgencyPortalRequest } from '~/lib/agency-portal-request';
import { loadCompletedProductTours } from '~/lib/product-tour/product-tour.actions';
import type { CompletedProductTours } from '~/lib/product-tour/types';

import { AgencyPortalShell } from './_components/agency-portal-shell';
import { PortalProductTourHost } from './_components/portal-product-tour-host';
import { PortalShell } from './_components/portal-shell';
import { loadClientPortalContext } from './_lib/server/client-portal.loader';
import { createClientPortalService } from './_lib/server/client-portal.service';
import { loadPortalCreditsSnapshot } from './_lib/server/portal-credits.loader';
import { loadPortalPaymentNotice } from './_lib/server/portal-payment-notice.loader';

interface PortalSlugLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function PortalSlugLayout({
  children,
  params,
}: PortalSlugLayoutProps) {
  const { slug } = await params;

  if (await isAgencyPortalRequest(slug)) {
    const branding = await getAgencyBrandingBySlug(slug);

    if (!branding) {
      notFound();
    }

    return (
      <AgencyPortalShell branding={branding}>{children}</AgencyPortalShell>
    );
  }

  const ctx = await loadClientPortalContext(slug);

  const portal = createClientPortalService(getSupabaseServerClient());
  const [credits, incompleteTaskCount, paymentNotice] = await Promise.all([
    loadPortalCreditsSnapshot(ctx.clientOrgId),
    portal.countOpenPortalMyTasks(ctx.clientOrgId).catch(() => 0),
    loadPortalPaymentNotice(ctx.clientOrgId).catch(() => null),
  ]);
  const creditBalance = credits?.balance ?? 0;
  const creditsPerCycle = credits?.creditsPerCycle ?? null;

  let completedTours: CompletedProductTours = {};
  try {
    completedTours = await loadCompletedProductTours();
  } catch {
    completedTours = {};
  }

  return (
    <PortalShell
      clientSlug={slug}
      clientOrgId={ctx.clientOrgId}
      orgName={ctx.orgName}
      clientPictureUrl={ctx.clientPictureUrl}
      accountName={ctx.accountName}
      accountLogoUrl={ctx.accountLogoUrl}
      displayName={ctx.displayName}
      userEmail={ctx.userEmail}
      userAvatarUrl={ctx.userAvatarUrl}
      creditBalance={creditBalance}
      creditsPerCycle={creditsPerCycle}
      hasWorkspaceAccess={ctx.hasWorkspaceAccess}
      showWebsiteNav={ctx.showWebsiteNav}
      showProjectsNav={ctx.showProjectsNav}
      showMeetingsNav={ctx.showMeetingsNav}
      showMessagesNav={ctx.showMessagesNav}
      incompleteTaskCount={incompleteTaskCount}
      paymentNotice={paymentNotice}
    >
      {children}
      <PortalProductTourHost completedTours={completedTours} />
    </PortalShell>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (await isAgencyPortalRequest(slug)) {
    const branding = await getAgencyBrandingBySlug(slug);

    if (!branding) {
      return { title: 'Portal' };
    }

    const brandName = branding.brand_name?.trim() || 'Portal';

    return {
      title: `${brandName} | Portal`,
    };
  }

  try {
    const client = getSupabaseServerClient();
    const { data } = await client
      .from('client_orgs')
      .select('name')
      .eq('slug', slug)
      .maybeSingle();

    const name = data?.name?.trim();
    const isPlaceholder = name
      ? ['business', 'individual', 'client'].includes(name.toLowerCase())
      : true;

    return {
      title:
        !isPlaceholder && name ? `${name} — Client portal` : 'Client portal',
    };
  } catch {
    return { title: 'Client portal' };
  }
}
