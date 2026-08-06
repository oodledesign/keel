import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createWebsitesService } from '~/home/[account]/websites/_lib/server/websites.service';
import pathsConfig from '~/config/paths.config';
import { formatEmailDeliveryError } from '~/lib/email/format-email-delivery-error';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { createSupportPublicToken } from '~/lib/support/support-tokens';

import type {
  ClientPortalInvite,
  ContactPortalAccess,
  ContactPortalAccessStatus,
} from './client-portal-invites.types';

// Tables may lag generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function invitesTable(admin: { from: (table: string) => any }) {
  return admin.from('client_portal_invites');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function membersTable(admin: { from: (table: string) => any }) {
  return admin.from('client_members');
}

function contactPrimaryEmail(contact: {
  email: string | null;
  emails?: Array<{ email: string; is_primary: boolean }> | null;
}): string | null {
  const fromList = contact.emails?.find((item) => item.is_primary)?.email
    ?? contact.emails?.[0]?.email;
  const raw = (fromList ?? contact.email ?? '').trim().toLowerCase();
  return raw.includes('@') ? raw : null;
}

async function assertCanManageClient(accountId: string, clientId: string) {
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

  const admin = getSupabaseServerAdminClient();
  const { data: clientRow } = await admin
    .from('clients')
    .select('id, display_name, company_name, email')
    .eq('id', clientId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!clientRow) throw new Error('Client not found');

  return {
    user,
    clientRow: clientRow as {
      id: string;
      display_name: string | null;
      company_name: string | null;
      email: string | null;
    },
  };
}

function buildAcceptUrl(token: string) {
  const path = pathsConfig.app.joinPortalInviteAccept.replace('[token]', token);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}${path}` : path;
}

export function buildPortalInviteAcceptUrl(token: string) {
  return buildAcceptUrl(token);
}

export function buildClientPortalPath(clientOrgSlug: string) {
  return pathsConfig.app.clientPortalHome.replace(
    '[clientSlug]',
    clientOrgSlug,
  );
}

function mapInvite(
  row: Record<string, unknown>,
  extras: Partial<ClientPortalInvite> = {},
  options: { includeInviteToken?: boolean } = {},
): ClientPortalInvite {
  const invite: ClientPortalInvite = {
    id: String(row.id),
    accountId: String(row.account_id),
    clientId: String(row.client_id),
    clientOrgId: String(row.client_org_id),
    contactId: (row.contact_id as string | null) ?? null,
    invitedEmail: String(row.invited_email),
    invitedBy: String(row.invited_by),
    userId: (row.user_id as string | null) ?? null,
    role: (row.role as ClientPortalInvite['role']) ?? 'member',
    status: row.status as ClientPortalInvite['status'],
    createdAt: String(row.created_at),
    acceptedAt: (row.accepted_at as string | null) ?? null,
    clientOrgSlug: null,
    clientOrgName: null,
    accountSlug: null,
    accountName: null,
    ...extras,
  };

  if (options.includeInviteToken !== false) {
    invite.inviteToken = String(row.invite_token);
  }

  return invite;
}

async function hydrateInvites(
  rows: Record<string, unknown>[],
  options: { includeInviteToken?: boolean } = {},
): Promise<ClientPortalInvite[]> {
  if (rows.length === 0) return [];

  const admin = getSupabaseServerAdminClient();
  const orgIds = [...new Set(rows.map((row) => String(row.client_org_id)))];
  const accountIds = [...new Set(rows.map((row) => String(row.account_id)))];

  const [{ data: orgs }, { data: accounts }] = await Promise.all([
    admin.from('client_orgs').select('id, slug, name').in('id', orgIds),
    admin.from('accounts').select('id, slug, name').in('id', accountIds),
  ]);

  const orgById = new Map(
    ((orgs ?? []) as Array<Record<string, unknown>>).map((org) => [
      String(org.id),
      org,
    ]),
  );
  const accountById = new Map(
    ((accounts ?? []) as Array<Record<string, unknown>>).map((account) => [
      String(account.id),
      account,
    ]),
  );

  return rows.map((row) => {
    const org = orgById.get(String(row.client_org_id));
    const account = accountById.get(String(row.account_id));

    return mapInvite(
      row,
      {
        clientOrgSlug: (org?.slug as string | null) ?? null,
        clientOrgName: (org?.name as string | null) ?? null,
        accountSlug: (account?.slug as string | null) ?? null,
        accountName:
          ((account?.name as string | null) ?? '').trim() ||
          (account?.slug as string | null) ||
          null,
      },
      options,
    );
  });
}

async function ensureClientOrg(accountId: string, clientId: string) {
  const client = getSupabaseServerClient();
  const service = createWebsitesService(client);
  return service.resolveOrCreateClientOrgForCrmClient(accountId, clientId);
}

async function ensureClientMember(input: {
  clientOrgId: string;
  userId: string;
  role?: 'owner' | 'member' | 'viewer';
  isPrimaryContact?: boolean;
}) {
  const admin = getSupabaseServerAdminClient();
  const { data: existing } = await membersTable(admin)
    .select('id')
    .eq('client_org_id', input.clientOrgId)
    .eq('user_id', input.userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await membersTable(admin).insert({
    client_org_id: input.clientOrgId,
    user_id: input.userId,
    role: input.role ?? 'member',
    is_primary_contact: input.isPrimaryContact ?? false,
    joined_at: new Date().toISOString(),
  });

  if (error) throw new Error(error.message);
}

/**
 * Stamps contacts.user_id so the portal loader can resolve this user's own
 * CRM contact record (first name, photo) directly. Best-effort: never
 * overwrites an existing link, never blocks the invite-accept flow.
 */
async function linkContactToUser(contactId: string | null, userId: string) {
  if (!contactId) return;

  const admin = getSupabaseServerAdminClient();
  try {
    await admin
      .from('contacts')
      .update({ user_id: userId })
      .eq('id', contactId)
      .is('user_id', null);
  } catch (error) {
    console.warn('[client-portal-invites] link contact to user failed', error);
  }
}

export async function getClientPortalInviteByToken(
  token: string,
): Promise<ClientPortalInvite | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await invitesTable(admin)
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !data) return null;
  const [invite] = await hydrateInvites([data as Record<string, unknown>]);
  return invite ?? null;
}

export async function listClientPortalInvitesForClient(
  accountId: string,
  clientId: string,
): Promise<ClientPortalInvite[]> {
  await assertCanManageClient(accountId, clientId);
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await invitesTable(admin)
    .select('*')
    .eq('account_id', accountId)
    .eq('client_id', clientId)
    .in('status', ['pending', 'accepted', 'revoked'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return hydrateInvites((data ?? []) as Record<string, unknown>[], {
    includeInviteToken: false,
  });
}

export async function listContactPortalAccess(input: {
  accountId: string;
  clientId: string;
  contacts: Array<{
    id: string;
    email: string | null;
    emails?: Array<{ email: string; is_primary: boolean }> | null;
    is_primary?: boolean;
  }>;
}): Promise<ContactPortalAccess[]> {
  await assertCanManageClient(input.accountId, input.clientId);
  const invites = await listClientPortalInvitesForClient(
    input.accountId,
    input.clientId,
  );

  const admin = getSupabaseServerAdminClient();
  const { data: clientRow } = await admin
    .from('clients')
    .select('client_org_id')
    .eq('id', input.clientId)
    .eq('account_id', input.accountId)
    .maybeSingle();

  const clientOrgId =
    (clientRow as { client_org_id?: string | null } | null)?.client_org_id ??
    null;

  const memberEmails = new Set<string>();
  if (clientOrgId) {
    const { data: members } = await membersTable(admin)
      .select('user_id')
      .eq('client_org_id', clientOrgId);

    const userIds = ((members ?? []) as Array<{ user_id: string | null }>)
      .map((row) => row.user_id)
      .filter((id): id is string => Boolean(id));

    if (userIds.length > 0) {
      const { data: accounts } = await admin
        .from('accounts')
        .select('email')
        .in('id', userIds)
        .eq('is_personal_account', true);

      for (const account of (accounts ?? []) as Array<{
        email: string | null;
      }>) {
        if (account.email) {
          memberEmails.add(account.email.trim().toLowerCase());
        }
      }
    }
  }

  return input.contacts.map((contact) => {
    const email = contactPrimaryEmail(contact);
    const invite =
      invites.find(
        (item) =>
          item.contactId === contact.id ||
          (email && item.invitedEmail === email),
      ) ?? null;

    let status: ContactPortalAccessStatus = 'not_invited';
    if (email && memberEmails.has(email)) {
      status = 'active';
    } else if (invite?.status === 'accepted') {
      status = 'active';
    } else if (invite?.status === 'pending') {
      status = 'invited';
    } else if (invite?.status === 'revoked') {
      status = 'revoked';
    }

    return {
      contactId: contact.id,
      email,
      status,
      inviteId: invite?.id ?? null,
      lastLogin: null,
    };
  });
}

export async function createClientPortalInvite(input: {
  accountId: string;
  accountSlug: string;
  clientId: string;
  contactId?: string | null;
  email: string;
  role?: 'owner' | 'member' | 'viewer';
}): Promise<{
  invite: ClientPortalInvite;
  acceptUrl: string;
  emailSent: boolean;
  emailError?: string;
}> {
  const { user, clientRow } = await assertCanManageClient(
    input.accountId,
    input.clientId,
  );

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address');
  }

  const { clientOrgId } = await ensureClientOrg(
    input.accountId,
    input.clientId,
  );

  const admin = getSupabaseServerAdminClient();
  const inviteToken = createSupportPublicToken(24);
  const role = input.role ?? 'member';

  const { data: existing } = await invitesTable(admin)
    .select('*')
    .eq('client_org_id', clientOrgId)
    .eq('invited_email', email)
    .maybeSingle();

  let row: Record<string, unknown>;

  if (existing) {
    const { data, error } = await invitesTable(admin)
      .update({
        status: 'pending',
        role,
        contact_id: input.contactId ?? (existing as { contact_id: string | null }).contact_id,
        invited_by: user.id,
        invite_token: inviteToken,
        user_id: null,
        accepted_at: null,
        client_id: input.clientId,
        account_id: input.accountId,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    row = data as Record<string, unknown>;
  } else {
    const { data, error } = await invitesTable(admin)
      .insert({
        account_id: input.accountId,
        client_id: input.clientId,
        client_org_id: clientOrgId,
        contact_id: input.contactId ?? null,
        invited_email: email,
        invited_by: user.id,
        role,
        status: 'pending',
        invite_token: inviteToken,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    row = data as Record<string, unknown>;
  }

  const [invite] = await hydrateInvites([row]);
  if (!invite?.inviteToken) throw new Error('Failed to create invite');

  const acceptUrl = buildAcceptUrl(invite.inviteToken);
  const clientLabel =
    clientRow.company_name?.trim() ||
    clientRow.display_name?.trim() ||
    'your client portal';
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const from = resolveTransactionalEmailFrom(productName);

  let emailSent = false;
  let emailError: string | undefined;

  if (from) {
    const html = wrapNotificationEmail(
      `<p style="margin:0 0 12px;">You have been invited to access the client portal for <strong>${escapeNotificationHtml(clientLabel)}</strong> on ${escapeNotificationHtml(productName)}.</p>
      <p style="margin:0 0 12px;font-size:13px;color:#5A4450;">Open the link to create your login (or sign in if you already have one), then you can view your portal and update your profile.</p>
      <p style="margin:0;font-size:13px;color:#5A4450;">Or open this link:<br /><a href="${escapeNotificationHtml(acceptUrl)}" style="color:#FF5C34;word-break:break-all;">${escapeNotificationHtml(acceptUrl)}</a></p>`,
      {
        productName,
        title: 'Client portal invite',
        heading: "You've been invited to a client portal",
        preview: `Access ${clientLabel}`,
        cta: { label: 'Open portal invite', href: acceptUrl },
        footerNote: `You're receiving this because someone invited you to a client portal on ${escapeNotificationHtml(productName)}.`,
      },
    );

    try {
      await sendPlatformEmail({
        type: 'invitation',
        accountId: input.accountId,
        mail: {
          to: email,
          from,
          subject: `Invite to ${clientLabel} portal`,
          html,
        },
        metadata: {
          kind: 'client_portal_invite',
          clientId: input.clientId,
          inviteId: invite.id,
          accountSlug: input.accountSlug,
        },
      });
      emailSent = true;
    } catch (error) {
      emailError = formatEmailDeliveryError(error);
      console.error('[client-portal-invites] email failed', emailError, error);
    }
  } else {
    emailError =
      'No email sender configured (set ZEPTOMAIL_FROM_ADDRESS or EMAIL_SENDER).';
    console.warn('[client-portal-invites]', emailError);
  }

  return { invite, acceptUrl, emailSent, emailError };
}

export async function inviteAllClientContactsToPortal(input: {
  accountId: string;
  accountSlug: string;
  clientId: string;
  contacts: Array<{
    id: string;
    email: string | null;
    emails?: Array<{ email: string; is_primary: boolean }> | null;
  }>;
}): Promise<{
  invited: number;
  skipped: number;
  failures: Array<{ contactId: string; email: string; error: string }>;
}> {
  await assertCanManageClient(input.accountId, input.clientId);

  let invited = 0;
  let skipped = 0;
  const failures: Array<{ contactId: string; email: string; error: string }> =
    [];

  const seen = new Set<string>();

  for (const contact of input.contacts) {
    const email = contactPrimaryEmail(contact);
    if (!email) {
      skipped += 1;
      continue;
    }
    if (seen.has(email)) {
      skipped += 1;
      continue;
    }
    seen.add(email);

    try {
      const result = await createClientPortalInvite({
        accountId: input.accountId,
        accountSlug: input.accountSlug,
        clientId: input.clientId,
        contactId: contact.id,
        email,
      });

      if (!result.emailSent && result.emailError) {
        failures.push({
          contactId: contact.id,
          email,
          error: result.emailError,
        });
      } else {
        invited += 1;
      }
    } catch (error) {
      failures.push({
        contactId: contact.id,
        email,
        error: error instanceof Error ? error.message : 'Invite failed',
      });
    }
  }

  return { invited, skipped, failures };
}

export async function acceptClientPortalInvite(
  token: string,
): Promise<ClientPortalInvite> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) throw new Error('Authentication required');

  const invite = await getClientPortalInviteByToken(token);
  if (!invite) throw new Error('Invite not found');
  if (invite.status === 'revoked') throw new Error('This invite was revoked');

  const email = user.email.trim().toLowerCase();
  if (email !== invite.invitedEmail.toLowerCase()) {
    throw new Error('Sign in with the email address this invite was sent to');
  }

  await ensureClientMember({
    clientOrgId: invite.clientOrgId,
    userId: user.id,
    role: invite.role,
  });
  await linkContactToUser(invite.contactId, user.id);

  if (invite.status === 'accepted' && invite.userId === user.id) {
    return invite;
  }

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await invitesTable(admin)
    .update({
      status: 'accepted',
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id)
    .in('status', ['pending', 'accepted'])
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (!data) {
    const again = await getClientPortalInviteByToken(token);
    if (again?.status === 'accepted' && again.userId === user.id) {
      return again;
    }
    throw new Error('Could not accept invite');
  }

  const [updated] = await hydrateInvites([data as Record<string, unknown>]);
  if (!updated) throw new Error('Could not accept invite');
  return updated;
}

export async function linkPendingClientPortalInvitesForUser(): Promise<number> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) return 0;

  const email = user.email.trim().toLowerCase();
  const admin = getSupabaseServerAdminClient();
  const { data: pending, error } = await invitesTable(admin)
    .select('*')
    .eq('invited_email', email)
    .eq('status', 'pending')
    .is('user_id', null);

  if (error) {
    console.warn('[client-portal-invites] link pending:', error.message);
    return 0;
  }

  let linked = 0;
  for (const row of (pending ?? []) as Record<string, unknown>[]) {
    try {
      await ensureClientMember({
        clientOrgId: String(row.client_org_id),
        userId: user.id,
        role: (row.role as 'owner' | 'member' | 'viewer') ?? 'member',
      });
      await linkContactToUser(
        (row.contact_id as string | null) ?? null,
        user.id,
      );

      const { error: updateError } = await invitesTable(admin)
        .update({
          status: 'accepted',
          user_id: user.id,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', String(row.id))
        .eq('status', 'pending');

      if (!updateError) linked += 1;
    } catch (linkError) {
      console.warn('[client-portal-invites] link failed', linkError);
    }
  }

  return linked;
}

export async function revokeClientPortalInvite(input: {
  accountId: string;
  clientId: string;
  inviteId: string;
}): Promise<void> {
  await assertCanManageClient(input.accountId, input.clientId);
  const admin = getSupabaseServerAdminClient();
  const { error } = await invitesTable(admin)
    .update({ status: 'revoked' })
    .eq('id', input.inviteId)
    .eq('client_id', input.clientId)
    .eq('account_id', input.accountId);

  if (error) throw new Error(error.message);
}
