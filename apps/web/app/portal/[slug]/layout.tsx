import { ReactNode } from 'react';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getAgencyBrandingBySlug } from '~/lib/agency-branding';
import { isAgencyPortalRequest } from '~/lib/agency-portal-request';

import { AgencyPortalShell } from './_components/agency-portal-shell';
import { PortalShell } from './_components/portal-shell';
import { loadClientPortalContext } from './_lib/server/client-portal.loader';
import { createPortalCreditsService } from './_lib/server/portal-credits.service';

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

  let creditBalance = 0;
  let creditsPerCycle: number | null = null;
  try {
    const credits = await createPortalCreditsService(
      getSupabaseServerClient(),
    ).getCreditsBundle(ctx.clientOrgId);
    creditBalance = credits.balance;
    creditsPerCycle = credits.creditsPerCycle;
  } catch {
    // Credits are optional — keep the shell usable if the pool is missing.
  }

  return (
    <PortalShell
      clientSlug={slug}
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
      showMessagesNav={ctx.showMessagesNav}
    >
      {children}
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
