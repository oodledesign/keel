import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadPublicMatchesByToken } from '~/lib/commercial/circulation/public-matches';

import { PublicMatchesClient } from './_components/public-matches-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ token: string }>;
}

export const generateMetadata = async ({ params }: PageProps) => {
  const { token } = await params;
  const admin = getSupabaseServerAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null;
  const data = await loadPublicMatchesByToken(admin, token, siteUrl);
  return {
    title: data ? `Matches · ${data.agencyName}` : 'Matches not found',
    robots: { index: false, follow: false },
  };
};

export default async function PublicMatchesPage({ params }: PageProps) {
  const { token } = await params;
  const admin = getSupabaseServerAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? null;
  const data = await loadPublicMatchesByToken(admin, token, siteUrl);
  if (!data) notFound();

  return (
    <PublicMatchesClient
      token={data.token}
      email={data.email}
      contactName={data.contactName}
      agencyName={data.agencyName}
      brand={{
        logoUrl: data.brand.logo_url,
        primaryColor: data.brand.primary_color,
        secondaryColor: data.brand.secondary_color,
        accentColor: data.brand.accent_color,
      }}
      initialUnsubscribed={data.unsubscribed}
      initialNotifyOnNewMatch={data.notifyOnNewMatch}
      initialRequirement={data.requirement}
      listings={data.listings}
    />
  );
}
