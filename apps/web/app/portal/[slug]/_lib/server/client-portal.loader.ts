import 'server-only';

import { cache } from 'react';

import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

export type ClientPortalContext = {
  userId: string;
  userEmail: string | null;
  displayName: string;
  clientOrgId: string;
  accountId: string;
  clientSlug: string;
  orgName: string;
  membershipRole: string | null;
};

function portalPath(clientSlug: string) {
  return pathsConfig.app.clientPortalHome.replace('[clientSlug]', clientSlug);
}

export const loadClientPortalContext = cache(
  async (clientSlug: string): Promise<ClientPortalContext> => {
    const client = getSupabaseServerClient();
    const nextPath = portalPath(clientSlug);
    const auth = await requireUser(client, { next: nextPath });

    if (auth.error ?? !auth.data) {
      redirect(auth.redirectTo);
    }

    const user = auth.data;

    const { data: org, error: orgError } = await client
      .from('client_orgs')
      .select('id, business_id, name, slug')
      .eq('slug', clientSlug)
      .maybeSingle();

    if (orgError || !org) {
      notFound();
    }

    const accountId = org.business_id as string;

    const { data: moduleSetting } = await client
      .from('account_module_settings')
      .select('enabled')
      .eq('account_id', accountId)
      .eq('module_key', 'client_portal')
      .maybeSingle();

    if (moduleSetting && moduleSetting.enabled === false) {
      notFound();
    }

    const { data: membership, error: membershipError } = await client
      .from('client_members')
      .select('id, role')
      .eq('client_org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      redirect(pathsConfig.app.home);
    }

    const { data: profile } = await client
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    const displayName =
      profile?.full_name?.trim() || user.email?.split('@')[0] || 'there';

    return {
      userId: user.id,
      userEmail: user.email ?? null,
      displayName,
      clientOrgId: org.id,
      accountId,
      clientSlug,
      orgName: org.name?.trim() || 'Client portal',
      membershipRole: membership.role ?? null,
    };
  },
);
