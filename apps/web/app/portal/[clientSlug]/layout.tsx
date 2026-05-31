import { ReactNode } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { PortalShell } from './_components/portal-shell';
import { loadClientPortalContext } from './_lib/server/client-portal.loader';

interface ClientPortalLayoutProps {
  children: ReactNode;
  params: Promise<{ clientSlug: string }>;
}

export default async function ClientPortalLayout({
  children,
  params,
}: ClientPortalLayoutProps) {
  const { clientSlug } = await params;
  const ctx = await loadClientPortalContext(clientSlug);

  return (
    <PortalShell
      clientSlug={clientSlug}
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
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;

  try {
    const client = getSupabaseServerClient();
    const { data } = await client
      .from('client_orgs')
      .select('name')
      .eq('slug', clientSlug)
      .maybeSingle();

    return {
      title: data?.name ? `${data.name} — Client portal` : 'Client portal',
    };
  } catch {
    return { title: 'Client portal' };
  }
}
