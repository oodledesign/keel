import { headers } from 'next/headers';

import { getAgencyBrandingBySlug } from '~/lib/agency-branding';
import { AGENCY_PORTAL_REQUEST_HEADER } from '~/lib/agency-portal-host';

import ClientPortalOverviewPage from './_components/client-portal-overview-page';

interface PortalSlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalSlugPage({ params }: PortalSlugPageProps) {
  const { slug } = await params;
  const requestHeaders = await headers();
  const isAgencyPortal = requestHeaders.get(AGENCY_PORTAL_REQUEST_HEADER) === '1';

  if (isAgencyPortal) {
    const branding = await getAgencyBrandingBySlug(slug);
    const brandName = branding?.brand_name?.trim() || 'Agency';

    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold text-white">
          Welcome to the {brandName} portal
        </h1>
        <p className="text-zinc-400">
          Client portal features will appear here soon.
        </p>
      </div>
    );
  }

  return <ClientPortalOverviewPage slug={slug} />;
}
