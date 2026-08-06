import 'server-only';

import { cache } from 'react';

import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';
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
  hasContactRecord: boolean;
  hasWorkspaceAccess: boolean;
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

    // The portal's identity is the client contact set by the agency in the
    // CRM (first name + photo), not the portal user's own Ozer account.
    // Prefer an already-linked contact; fall back to an email match within
    // this client_org and self-heal the link for next time. Uses the admin
    // client — a not-yet-linked contact row's user_id isn't the caller's,
    // and portal contacts have no accounts_memberships row, so RLS on
    // `contacts` (own row, or account-member) would hide it entirely.
    let contact: {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      picture_url?: string | null;
    } | null = null;

    const admin = getSupabaseServerAdminClient();

    const { data: linkedContacts } = await admin
      .from('contacts')
      .select('id, first_name, last_name, full_name, picture_url, client_org_id')
      .eq('user_id', user.id)
      .limit(5);

    const linkedRows = (linkedContacts ?? []) as Array<{
      id: string;
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      picture_url?: string | null;
      client_org_id?: string | null;
    }>;

    contact =
      linkedRows.find((row) => row.client_org_id === org.id) ??
      linkedRows[0] ??
      null;

    if (!contact && user.email) {
      const { data: orgContacts } = await admin
        .from('contacts')
        .select('id, first_name, last_name, full_name, picture_url, email')
        .eq('client_org_id', org.id)
        .is('user_id', null)
        .limit(50);

      const targetEmail = user.email.trim().toLowerCase();
      const candidate = (
        (orgContacts ?? []) as Array<{
          id: string;
          first_name?: string | null;
          last_name?: string | null;
          full_name?: string | null;
          picture_url?: string | null;
          email?: string | null;
        }>
      ).find((row) => row.email?.trim().toLowerCase() === targetEmail);

      if (candidate) {
        contact = candidate;
        await admin
          .from('contacts')
          .update({ user_id: user.id })
          .eq('id', candidate.id)
          .is('user_id', null);
      }
    }

    const contactFirstName =
      contact?.first_name?.trim() ||
      contact?.full_name?.trim().split(/\s+/)[0] ||
      null;

    const displayName =
      contactFirstName ||
      accountRow?.name?.trim().split(/\s+/)[0] ||
      profile?.full_name?.trim().split(/\s+/)[0] ||
      user.email?.split('@')[0] ||
      'there';

    const userAvatarUrl =
      toSupabasePublicStorageUrl(contact?.picture_url ?? null) ??
      accountRow?.picture_url ??
      null;

    const [clientPictures, businessBrand, websiteCount, orgClients, teamMembership] =
      await Promise.all([
        loadClientPicturesByOrgIds(client, [org.id]),
        loadSupportBusinessBrand(accountId),
        client
          .from('websites')
          .select('id', { count: 'exact', head: true })
          .eq('client_org_id', org.id),
        client.from('clients').select('id').eq('client_org_id', org.id),
        client
          .from('accounts_memberships')
          .select('account_id', { count: 'exact', head: true })
          .eq('user_id', user.id),
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
      userAvatarUrl,
      hasContactRecord: contact !== null,
      hasWorkspaceAccess: (teamMembership.count ?? 0) > 0,
      showWebsiteNav: (websiteCount.count ?? 0) > 0,
      showProjectsNav: (portalVisibleProjectCount ?? 0) > 0,
      showMessagesNav,
    };
  },
);
