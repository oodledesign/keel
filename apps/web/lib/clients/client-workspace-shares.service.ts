import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { resolveClientOrgAccountId } from '~/lib/support/resolve-client-org-account';
import { createSupportPublicToken } from '~/lib/support/support-tokens';

export type ShareCapabilities = {
  canSupport: boolean;
  canContacts: boolean;
  canProjects: boolean;
  canDocs: boolean;
  canFinance: boolean;
  canPortal: boolean;
};

export type ClientWorkspaceShare = {
  id: string;
  ownerAccountId: string;
  clientOrgId: string;
  clientId: string | null;
  guestAccountId: string | null;
  status: 'pending' | 'active' | 'revoked' | 'expired';
  inviteToken: string;
  invitedEmail: string | null;
  capabilities: ShareCapabilities;
  invitedBy: string | null;
  acceptedBy: string | null;
  acceptedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  guestAccountSlug: string | null;
  guestAccountName: string | null;
  ownerAccountSlug: string | null;
  ownerAccountName: string | null;
  clientOrgName: string | null;
  clientOrgSlug: string | null;
  clientDisplayName: string | null;
};

const DEFAULT_EXPIRE_DAYS = 14;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sharesTable(admin: { from: (table: string) => any }) {
  return admin.from('client_workspace_shares');
}

function mapCapabilities(row: Record<string, unknown>): ShareCapabilities {
  return {
    canSupport: Boolean(row.can_support),
    canContacts: Boolean(row.can_contacts),
    canProjects: Boolean(row.can_projects),
    canDocs: Boolean(row.can_docs),
    canFinance: Boolean(row.can_finance),
    canPortal: Boolean(row.can_portal),
  };
}

function mapShare(
  row: Record<string, unknown>,
  extras: Partial<ClientWorkspaceShare> = {},
): ClientWorkspaceShare {
  return {
    id: String(row.id),
    ownerAccountId: String(row.owner_account_id),
    clientOrgId: String(row.client_org_id),
    clientId: (row.client_id as string | null) ?? null,
    guestAccountId: (row.guest_account_id as string | null) ?? null,
    status: row.status as ClientWorkspaceShare['status'],
    inviteToken: String(row.invite_token),
    invitedEmail: (row.invited_email as string | null) ?? null,
    capabilities: mapCapabilities(row),
    invitedBy: (row.invited_by as string | null) ?? null,
    acceptedBy: (row.accepted_by as string | null) ?? null,
    acceptedAt: (row.accepted_at as string | null) ?? null,
    expiresAt: (row.expires_at as string | null) ?? null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    guestAccountSlug: null,
    guestAccountName: null,
    ownerAccountSlug: null,
    ownerAccountName: null,
    clientOrgName: null,
    clientOrgSlug: null,
    clientDisplayName: null,
    ...extras,
  };
}

async function assertAccountManager(accountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', accountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (membership as { account_role?: string } | null)?.account_role;
  if (!role || role === 'contractor' || role === 'client') {
    throw new Error('Permission denied');
  }

  return user;
}

async function assertCanManageClientOrg(
  accountId: string,
  clientOrgId: string,
) {
  await assertAccountManager(accountId);
  const admin = getSupabaseServerAdminClient();
  const { data: org } = await admin
    .from('client_orgs')
    .select('id, business_id, slug, name')
    .eq('id', clientOrgId)
    .maybeSingle();

  if (!org) throw new Error('Client not found');

  const orgAccountId = await resolveClientOrgAccountId(
    admin,
    org as { business_id?: string | null },
  );
  const businessId = (org as { business_id?: string | null }).business_id;
  const belongs = orgAccountId === accountId || businessId === accountId;

  if (!belongs) throw new Error('Client not found');

  return org as {
    id: string;
    business_id?: string | null;
    slug: string;
    name?: string | null;
  };
}

async function assertGuestWorkspaceManager(guestAccountId: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', guestAccountId)
    .eq('user_id', user.id)
    .maybeSingle();

  const role = (membership as { account_role?: string } | null)?.account_role;
  if (role !== 'owner' && role !== 'admin') {
    throw new Error('Only workspace owners or admins can accept shares');
  }

  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('id, slug, name, is_personal_account')
    .eq('id', guestAccountId)
    .maybeSingle();

  if (!account) throw new Error('Workspace not found');
  if ((account as { is_personal_account?: boolean }).is_personal_account) {
    throw new Error('Accept into a team workspace, not a personal account');
  }

  return { user, account };
}

function buildAcceptUrl(token: string) {
  const path = pathsConfig.app.joinClientShare.replace('[token]', token);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}${path}` : path;
}

export function buildClientShareAcceptUrl(token: string) {
  return buildAcceptUrl(token);
}

async function hydrateShares(
  rows: Record<string, unknown>[],
): Promise<ClientWorkspaceShare[]> {
  if (rows.length === 0) return [];

  const admin = getSupabaseServerAdminClient();
  const accountIds = [
    ...new Set(
      rows.flatMap((row) =>
        [row.owner_account_id, row.guest_account_id].filter(Boolean),
      ),
    ),
  ] as string[];
  const orgIds = [...new Set(rows.map((row) => String(row.client_org_id)))];
  const clientIds = [
    ...new Set(
      rows
        .map((row) => row.client_id as string | null)
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [{ data: accounts }, { data: orgs }, { data: clients }] =
    await Promise.all([
      accountIds.length
        ? admin.from('accounts').select('id, slug, name').in('id', accountIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      orgIds.length
        ? admin.from('client_orgs').select('id, name, slug').in('id', orgIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
      clientIds.length
        ? admin
            .from('clients')
            .select('id, display_name, company_name')
            .in('id', clientIds)
        : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    ]);

  const accountById = new Map(
    ((accounts ?? []) as Array<Record<string, unknown>>).map((account) => [
      String(account.id),
      account,
    ]),
  );
  const orgById = new Map(
    ((orgs ?? []) as Array<Record<string, unknown>>).map((org) => [
      String(org.id),
      org,
    ]),
  );
  const clientById = new Map(
    ((clients ?? []) as Array<Record<string, unknown>>).map((client) => [
      String(client.id),
      client,
    ]),
  );

  return rows.map((row) => {
    const owner = accountById.get(String(row.owner_account_id));
    const guest = row.guest_account_id
      ? accountById.get(String(row.guest_account_id))
      : null;
    const org = orgById.get(String(row.client_org_id));
    const client = row.client_id ? clientById.get(String(row.client_id)) : null;

    return mapShare(row, {
      ownerAccountSlug: (owner?.slug as string | null) ?? null,
      ownerAccountName:
        ((owner?.name as string | null) ?? '').trim() ||
        (owner?.slug as string | null) ||
        null,
      guestAccountSlug: (guest?.slug as string | null) ?? null,
      guestAccountName:
        ((guest?.name as string | null) ?? '').trim() ||
        (guest?.slug as string | null) ||
        null,
      clientOrgName:
        ((org?.name as string | null) ?? '').trim() ||
        (org?.slug as string | null) ||
        null,
      clientOrgSlug: (org?.slug as string | null) ?? null,
      clientDisplayName:
        ((client?.display_name as string | null) ?? '').trim() ||
        ((client?.company_name as string | null) ?? '').trim() ||
        null,
    });
  });
}

export async function listSharesForOwner(
  ownerAccountId: string,
  clientOrgId: string,
): Promise<ClientWorkspaceShare[]> {
  await assertCanManageClientOrg(ownerAccountId, clientOrgId);
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await sharesTable(admin)
    .select('*')
    .eq('owner_account_id', ownerAccountId)
    .eq('client_org_id', clientOrgId)
    .in('status', ['pending', 'active'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return hydrateShares((data ?? []) as Record<string, unknown>[]);
}

export async function listActiveSharesForGuest(
  guestAccountId: string,
): Promise<ClientWorkspaceShare[]> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: membership } = await client
    .from('accounts_memberships')
    .select('account_role')
    .eq('account_id', guestAccountId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!membership) throw new Error('Permission denied');

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await sharesTable(admin)
    .select('*')
    .eq('guest_account_id', guestAccountId)
    .eq('status', 'active')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('[client-shares] list guest:', error.message);
    return [];
  }

  return hydrateShares((data ?? []) as Record<string, unknown>[]);
}

export async function countActiveSharesForGuest(
  guestAccountId: string,
): Promise<number> {
  const admin = getSupabaseServerAdminClient();
  const { count, error } = await sharesTable(admin)
    .select('id', { count: 'exact', head: true })
    .eq('guest_account_id', guestAccountId)
    .eq('status', 'active');

  if (error) {
    console.warn('[client-shares] count guest:', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function countSupportSharesForGuest(
  guestAccountId: string,
): Promise<number> {
  const admin = getSupabaseServerAdminClient();
  const { count, error } = await sharesTable(admin)
    .select('id', { count: 'exact', head: true })
    .eq('guest_account_id', guestAccountId)
    .eq('status', 'active')
    .eq('can_support', true);

  if (error) {
    console.warn('[client-shares] count support:', error.message);
    return 0;
  }

  return count ?? 0;
}

export async function listSupportSharedOrgIds(
  guestAccountId: string,
): Promise<string[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await sharesTable(admin)
    .select('client_org_id')
    .eq('guest_account_id', guestAccountId)
    .eq('status', 'active')
    .eq('can_support', true);

  if (error) {
    console.warn('[client-shares] list support orgs:', error.message);
    return [];
  }

  return ((data ?? []) as Array<{ client_org_id: string }>).map(
    (row) => row.client_org_id,
  );
}

export async function listGuestAccountIdsWithSupportAccess(
  clientOrgId: string,
): Promise<string[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await sharesTable(admin)
    .select('guest_account_id')
    .eq('client_org_id', clientOrgId)
    .eq('status', 'active')
    .eq('can_support', true)
    .not('guest_account_id', 'is', null);

  if (error) {
    console.warn('[client-shares] guest support accounts:', error.message);
    return [];
  }

  return ((data ?? []) as Array<{ guest_account_id: string | null }>)
    .map((row) => row.guest_account_id)
    .filter((id): id is string => Boolean(id));
}

export async function getShareByIdForGuest(
  guestAccountId: string,
  shareId: string,
): Promise<ClientWorkspaceShare | null> {
  const shares = await listActiveSharesForGuest(guestAccountId);
  return shares.find((share) => share.id === shareId) ?? null;
}

export async function getShareByToken(
  token: string,
): Promise<ClientWorkspaceShare | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await sharesTable(admin)
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !data) return null;

  const [share] = await hydrateShares([data as Record<string, unknown>]);
  return share ?? null;
}

export async function createShareInvite(input: {
  ownerAccountId: string;
  clientOrgId: string;
  clientId?: string | null;
  invitedEmail?: string | null;
  capabilities: ShareCapabilities;
  accountSlug: string;
}): Promise<{ share: ClientWorkspaceShare; acceptUrl: string }> {
  const user = await assertCanManageClientOrg(
    input.ownerAccountId,
    input.clientOrgId,
  );
  void user;

  const invitedBy = await assertAccountManager(input.ownerAccountId);
  const caps = input.capabilities;
  if (
    !caps.canSupport &&
    !caps.canContacts &&
    !caps.canProjects &&
    !caps.canDocs &&
    !caps.canFinance &&
    !caps.canPortal
  ) {
    throw new Error('Select at least one module to share');
  }

  const admin = getSupabaseServerAdminClient();

  const { data: planLimits } = await admin
    .from('account_plan_limits')
    .select('plan_family')
    .eq('account_id', input.ownerAccountId)
    .maybeSingle();

  const planFamily =
    (planLimits as { plan_family?: string | null } | null)?.plan_family ?? null;

  const { data: entitlements } = await admin
    .from('account_entitlements')
    .select('entitlement_key')
    .eq('account_id', input.ownerAccountId)
    .in('entitlement_key', [
      'workspace_business',
      'workspace_commercial_property',
      'workspace_property',
    ]);

  const isPaidWorkspace =
    planFamily === 'business' ||
    planFamily === 'commercial_property' ||
    planFamily === 'property' ||
    (entitlements ?? []).length > 0;

  if (!isPaidWorkspace) {
    throw new Error(
      'Client and project sharing between workspaces requires a paid Business (or Commercial) plan. Upgrade to share with other workspaces.',
    );
  }

  const inviteToken = createSupportPublicToken(24);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DEFAULT_EXPIRE_DAYS);

  const { data, error } = await sharesTable(admin)
    .insert({
      owner_account_id: input.ownerAccountId,
      client_org_id: input.clientOrgId,
      client_id: input.clientId ?? null,
      status: 'pending',
      invite_token: inviteToken,
      invited_email: input.invitedEmail?.trim().toLowerCase() || null,
      can_support: caps.canSupport,
      can_contacts: caps.canContacts,
      can_projects: caps.canProjects,
      can_docs: caps.canDocs,
      can_finance: caps.canFinance,
      can_portal: caps.canPortal,
      invited_by: invitedBy.id,
      expires_at: expiresAt.toISOString(),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const [share] = await hydrateShares([data as Record<string, unknown>]);
  if (!share) throw new Error('Failed to create share');

  const acceptUrl = buildAcceptUrl(inviteToken);

  if (share.invitedEmail) {
    await sendShareInviteEmail({
      to: share.invitedEmail,
      ownerName: share.ownerAccountName ?? input.accountSlug,
      clientName: share.clientDisplayName ?? share.clientOrgName ?? 'a client',
      acceptUrl,
      ownerAccountId: input.ownerAccountId,
    });
  }

  return { share, acceptUrl };
}

async function sendShareInviteEmail(input: {
  to: string;
  ownerName: string;
  clientName: string;
  acceptUrl: string;
  ownerAccountId: string;
}) {
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const from =
    process.env.EMAIL_SENDER?.trim() ||
    (process.env.ZEPTOMAIL_FROM_ADDRESS
      ? `${productName} <${process.env.ZEPTOMAIL_FROM_ADDRESS}>`
      : null);

  if (!from) {
    console.warn('[client-shares] No email sender configured; skip invite');
    return;
  }

  const subject = `${input.ownerName} shared a client with you on ${productName}`;
  const html = wrapNotificationEmail(
    `<p style="margin:0 0 12px;"><strong>${escapeNotificationHtml(input.ownerName)}</strong> invited your workspace to access <strong>${escapeNotificationHtml(input.clientName)}</strong> on ${escapeNotificationHtml(productName)}.</p>
    <p style="margin:0;font-size:13px;color:#5A4450;">Or open this link:<br /><a href="${escapeNotificationHtml(input.acceptUrl)}" style="color:#FF5C34;word-break:break-all;">${escapeNotificationHtml(input.acceptUrl)}</a></p>`,
    {
      productName,
      title: 'Client workspace invite',
      heading: "You've been invited to a shared client",
      preview: `${input.ownerName} shared ${input.clientName} with you`,
      cta: { label: 'Review and accept', href: input.acceptUrl },
      footerNote: `You're receiving this because someone shared a client workspace with you on ${escapeNotificationHtml(productName)}.`,
    },
  );

  try {
    await sendPlatformEmail({
      type: 'invitation',
      accountId: input.ownerAccountId,
      mail: {
        to: input.to,
        from,
        subject,
        html,
      },
      metadata: { kind: 'client_workspace_share' },
    });
  } catch (error) {
    console.error('[client-shares] invite email failed', error);
  }
}

export async function acceptShareInvite(input: {
  token: string;
  guestAccountId: string;
}): Promise<ClientWorkspaceShare> {
  const { user } = await assertGuestWorkspaceManager(input.guestAccountId);
  const admin = getSupabaseServerAdminClient();

  const share = await getShareByToken(input.token);
  if (!share) throw new Error('Invite not found');
  if (share.status === 'revoked') throw new Error('This invite was revoked');
  if (share.status === 'expired') throw new Error('This invite has expired');
  if (share.status === 'active') {
    if (share.guestAccountId === input.guestAccountId) {
      return share;
    }
    throw new Error('This invite was already accepted by another workspace');
  }
  if (share.expiresAt && new Date(share.expiresAt).getTime() < Date.now()) {
    await sharesTable(admin)
      .update({ status: 'expired', updated_at: new Date().toISOString() })
      .eq('id', share.id);
    throw new Error('This invite has expired');
  }
  if (share.ownerAccountId === input.guestAccountId) {
    throw new Error('Cannot accept a share into the owning workspace');
  }

  const { data: existing } = await sharesTable(admin)
    .select('id')
    .eq('client_org_id', share.clientOrgId)
    .eq('guest_account_id', input.guestAccountId)
    .eq('status', 'active')
    .maybeSingle();

  if (existing) {
    throw new Error('This workspace already has access to that client');
  }

  const { data, error } = await sharesTable(admin)
    .update({
      status: 'active',
      guest_account_id: input.guestAccountId,
      accepted_by: user.id,
      accepted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', share.id)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) throw new Error(error.message);

  const [accepted] = await hydrateShares([data as Record<string, unknown>]);
  if (!accepted) throw new Error('Failed to accept share');
  return accepted;
}

export async function updateShareCapabilities(input: {
  ownerAccountId: string;
  shareId: string;
  capabilities: ShareCapabilities;
}): Promise<ClientWorkspaceShare> {
  const admin = getSupabaseServerAdminClient();
  const { data: existing, error: loadError } = await sharesTable(admin)
    .select('*')
    .eq('id', input.shareId)
    .eq('owner_account_id', input.ownerAccountId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error('Share not found');

  await assertCanManageClientOrg(
    input.ownerAccountId,
    String((existing as { client_org_id: string }).client_org_id),
  );

  const caps = input.capabilities;
  if (
    !caps.canSupport &&
    !caps.canContacts &&
    !caps.canProjects &&
    !caps.canDocs &&
    !caps.canFinance &&
    !caps.canPortal
  ) {
    throw new Error('Select at least one module');
  }

  const { data, error } = await sharesTable(admin)
    .update({
      can_support: caps.canSupport,
      can_contacts: caps.canContacts,
      can_projects: caps.canProjects,
      can_docs: caps.canDocs,
      can_finance: caps.canFinance,
      can_portal: caps.canPortal,
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.shareId)
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  const [share] = await hydrateShares([data as Record<string, unknown>]);
  if (!share) throw new Error('Failed to update share');
  return share;
}

export async function revokeShare(input: {
  ownerAccountId: string;
  shareId: string;
}): Promise<void> {
  const admin = getSupabaseServerAdminClient();
  const { data: existing, error: loadError } = await sharesTable(admin)
    .select('client_org_id')
    .eq('id', input.shareId)
    .eq('owner_account_id', input.ownerAccountId)
    .maybeSingle();

  if (loadError) throw new Error(loadError.message);
  if (!existing) throw new Error('Share not found');

  await assertCanManageClientOrg(
    input.ownerAccountId,
    String((existing as { client_org_id: string }).client_org_id),
  );

  const { error } = await sharesTable(admin)
    .update({
      status: 'revoked',
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.shareId);

  if (error) throw new Error(error.message);
}

export async function listAcceptableWorkspacesForUser(): Promise<
  Array<{ id: string; slug: string; name: string }>
> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Authentication required');

  const { data: memberships } = await client
    .from('accounts_memberships')
    .select('account_id, account_role')
    .eq('user_id', user.id)
    .in('account_role', ['owner', 'admin']);

  const accountIds = (memberships ?? []).map(
    (row) => (row as { account_id: string }).account_id,
  );
  if (accountIds.length === 0) return [];

  const admin = getSupabaseServerAdminClient();
  const { data: accounts } = await admin
    .from('accounts')
    .select('id, slug, name, is_personal_account')
    .in('id', accountIds)
    .eq('is_personal_account', false);

  return ((accounts ?? []) as Array<Record<string, unknown>>)
    .filter((account) => account.slug)
    .map((account) => ({
      id: String(account.id),
      slug: String(account.slug),
      name:
        ((account.name as string | null) ?? '').trim() || String(account.slug),
    }));
}
