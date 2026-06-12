import { ReactNode } from 'react';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getAgencyBrandingBySlug } from '~/lib/agency-branding';
import { AGENCY_PORTAL_REQUEST_HEADER } from '~/lib/agency-portal-host';

import { AgencyPortalShell } from './_components/agency-portal-shell';
import { PortalShell } from './_components/portal-shell';
import { loadClientPortalContext } from './_lib/server/client-portal.loader';

interface PortalSlugLayoutProps {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}

async function isAgencyPortalRequest() {
  const requestHeaders = await headers();

  return requestHeaders.get(AGENCY_PORTAL_REQUEST_HEADER) === '1';
}

export default async function PortalSlugLayout({
  children,
  params,
}: PortalSlugLayoutProps) {
  const { slug } = await params;

  if (await isAgencyPortalRequest()) {
    const branding = await getAgencyBrandingBySlug(slug);

    if (!branding) {
      notFound();
    }

    return <AgencyPortalShell branding={branding}>{children}</AgencyPortalShell>;
  }

  const ctx = await loadClientPortalContext(slug);

  return (
    <PortalShell
      clientSlug={slug}
      orgName={ctx.orgName}
      userEmail={ctx.userEmail}
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

  if (await isAgencyPortalRequest()) {
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

    return {
      title: data?.name ? `${data.name} — Client portal` : 'Client portal',
    };
  } catch {
    return { title: 'Client portal' };
  }
}
