import 'server-only';

import { cache } from 'react';

import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  loadClientPicturesByOrgIds,
  loadSupportBusinessBrand,
} from '~/lib/support/support-party-branding';

export type ClientPortalContext = {
  userId: string;
  userEmail: string | null;
  displayName: string;
  clientOrgId: string;
  accountId: string;
  accountSlug: string;
  accountName: string;
  accountLogoUrl: string | null;
  clientSlug: string;
  orgName: string;
  clientPictureUrl: string | null;
  membershipRole: string | null;
  userAvatarUrl: string | null;
  showWebsiteNav: boolean;
  showProjectsNav: boolean;
  showMessagesNav: boolean;
};

// Known placeholder/enum values that have ended up in client_orgs.name by
// mistake — never show these verbatim, fall back to the workspace's own name.
const PLACEHOLDER_ORG_NAMES = new Set(['business', 'individual', 'client']);

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

    const businessId = (org as { business_id?: string | null }).business_id;
    let accountId: string | null = null;

    if (businessId) {
      const { data: business } = await client
        .from('businesses')
        .select('account_id')
        .eq('id', businessId)
        .maybeSingle();
      accountId =
        (business as { account_id?: string | null } | null)?.account_id ??
        businessId;
    }

    if (!accountId) {
      notFound();
    }

    const { data: account } = await client
      .from('accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();

    const accountSlug =
      (account as { slug?: string | null } | null)?.slug?.trim() || clientSlug;

    const { data: moduleSettings } = await client
      .from('account_module_settings')
      .select('module_key, enabled')
      .eq('account_id', accountId)
      .in('module_key', ['client_portal', 'messages']);

    const moduleSettingRows = (moduleSettings ?? []) as Array<{
      module_key: string;
      enabled: boolean;
    }>;

    const clientPortalSetting = moduleSettingRows.find(
      (row) => row.module_key === 'client_portal',
    );

    if (clientPortalSetting && clientPortalSetting.enabled === false) {
      notFound();
    }

    const messagesSetting = moduleSettingRows.find(
      (row) => row.module_key === 'messages',
    );
    const showMessagesNav = messagesSetting?.enabled !== false;

    const { data: membership, error: membershipError } = await client
      .from('client_members')
      .select('id, role')
      .eq('client_org_id', org.id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membershipError || !membership) {
      redirect(pathsConfig.app.home);
    }

    const [{ data: profile }, { data: userAccount }] = await Promise.all([
      client
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle(),
      client
        .from('accounts')
        .select('name, picture_url')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const accountRow = userAccount as {
      name?: string | null;
      picture_url?: string | null;
    } | null;

    const displayName =
      accountRow?.name?.trim() ||
      profile?.full_name?.trim() ||
      user.email?.split('@')[0] ||
      'there';

    const [clientPictures, businessBrand, websiteCount, orgClients] =
      await Promise.all([
        loadClientPicturesByOrgIds(client, [org.id]),
        loadSupportBusinessBrand(accountId),
        client
          .from('websites')
          .select('id', { count: 'exact', head: true })
          .eq('client_org_id', org.id),
        client.from('clients').select('id').eq('client_org_id', org.id),
      ]);

    const orgClientIds = ((orgClients.data ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    // projects.client_org_id is a legacy/partial column (not always kept in
    // sync with client_id) — match on either to find portal-visible projects.
    const projectFilter =
      orgClientIds.length > 0
        ? `client_org_id.eq.${org.id},client_id.in.(${orgClientIds.join(',')})`
        : `client_org_id.eq.${org.id}`;

    const { count: portalVisibleProjectCount } = await client
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .eq('portal_visible', true)
      .or(projectFilter);

    const rawOrgName = org.name?.trim();
    const orgName =
      rawOrgName && !PLACEHOLDER_ORG_NAMES.has(rawOrgName.toLowerCase())
        ? rawOrgName
        : businessBrand.name || 'Client portal';

    return {
      userId: user.id,
      userEmail: user.email ?? null,
      displayName,
      clientOrgId: org.id,
      accountId,
      accountSlug,
      accountName: businessBrand.name,
      accountLogoUrl: businessBrand.logoUrl,
      clientSlug,
      orgName,
      clientPictureUrl: clientPictures.get(org.id) ?? null,
      membershipRole: membership.role ?? null,
      userAvatarUrl: accountRow?.picture_url ?? null,
      showWebsiteNav: (websiteCount.count ?? 0) > 0,
      showProjectsNav: (portalVisibleProjectCount ?? 0) > 0,
      showMessagesNav,
    };
  },
);
