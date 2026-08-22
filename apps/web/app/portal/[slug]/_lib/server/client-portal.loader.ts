import 'server-only';

import { cache } from 'react';

import { notFound, redirect } from 'next/navigation';

import { requireUser } from '@kit/supabase/require-user';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';
import { resolveClientOrgAccountId } from '~/lib/support/resolve-client-org-account';
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
    const accountId = await resolveClientOrgAccountId(client, {
      business_id: businessId,
    });

    if (!accountId) {
      notFound();
    }

    const admin = getSupabaseServerAdminClient();
    const { data: account } = await admin
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

    let membershipRole: string | null = membership?.role ?? null;

    if (membershipError) {
      redirect(pathsConfig.app.home);
    }

    if (!membership) {
      const { data: teamMembership } = await client
        .from('accounts_memberships')
        .select('account_role')
        .eq('account_id', accountId)
        .eq('user_id', user.id)
        .maybeSingle();

      const teamRole = (
        teamMembership as { account_role?: string | null } | null
      )?.account_role;

      if (!teamRole || teamRole === 'contractor' || teamRole === 'client') {
        redirect(pathsConfig.app.home);
      }

      membershipRole = null;
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
    // contacts.user_id is NOT a portal-login link — createContact() stamps
    // it with the *staff member* who created the record, so it's the same
    // value across every contact a given team member has ever added. The
    // real client link is the client_contacts junction table (contacts.
    // client_id/client_org_id are legacy fallback columns, usually null).
    // Match purely by email within this client_org's clients. Uses the
    // admin client — portal contacts have no accounts_memberships row, so
    // RLS on `contacts` (own row via user_id, or account-member) would hide
    // every row here regardless.
    const { data: orgClientRows } = await admin
      .from('clients')
      .select('id')
      .eq('client_org_id', org.id);

    const orgClientIds = ((orgClientRows ?? []) as Array<{ id: string }>).map(
      (row) => row.id,
    );

    let contact: {
      first_name?: string | null;
      last_name?: string | null;
      full_name?: string | null;
      picture_url?: string | null;
    } | null = null;

    if (user.email && orgClientIds.length > 0) {
      const { data: links } = await admin
        .from('client_contacts')
        .select('contact_id')
        .in('client_id', orgClientIds);

      const contactIds = [
        ...new Set(
          ((links ?? []) as Array<{ contact_id: string }>).map(
            (row) => row.contact_id,
          ),
        ),
      ];

      if (contactIds.length > 0) {
        const { data: candidates } = await admin
          .from('contacts')
          .select('first_name, last_name, full_name, picture_url, email')
          .in('id', contactIds);

        const targetEmail = user.email.trim().toLowerCase();
        contact =
          (
            (candidates ?? []) as Array<{
              first_name?: string | null;
              last_name?: string | null;
              full_name?: string | null;
              picture_url?: string | null;
              email?: string | null;
            }>
          ).find((row) => row.email?.trim().toLowerCase() === targetEmail) ??
          null;
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

    const [clientPictures, businessBrand, websiteCount, teamMembership] =
      await Promise.all([
        loadClientPicturesByOrgIds(client, [org.id]),
        loadSupportBusinessBrand(accountId),
        client
          .from('websites')
          .select('id', { count: 'exact', head: true })
          .eq('client_org_id', org.id)
          .eq('portal_visible', true),
        client
          .from('accounts_memberships')
          .select('account_id', { count: 'exact', head: true })
          .eq('user_id', user.id),
      ]);

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
      membershipRole,
      userAvatarUrl,
      hasContactRecord: contact !== null,
      hasWorkspaceAccess: (teamMembership.count ?? 0) > 0,
      showWebsiteNav: (websiteCount.count ?? 0) > 0,
      showProjectsNav: (portalVisibleProjectCount ?? 0) > 0,
      showMessagesNav,
    };
  },
);
