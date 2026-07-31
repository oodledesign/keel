import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { formatEmailDeliveryError } from '~/lib/email/format-email-delivery-error';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { resolveTransactionalEmailFrom } from '~/lib/email/zeptomail-client';
import type {
  ProjectGuest,
  ProjectGuestPermissions,
} from '~/lib/projects/project-guests.types';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { createSupportPublicToken } from '~/lib/support/support-tokens';

export type { ProjectGuest, ProjectGuestPermissions };

const DEFAULT_PERMISSIONS: ProjectGuestPermissions = {
  comment: true,
  create_task: true,
  edit_own_task: true,
};

// New tables / live project columns may lag generated Database types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function guestsTable(admin: { from: (table: string) => any }) {
  return admin.from('project_guests');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function projectsTable(admin: { from: (table: string) => any }) {
  return admin.from('projects');
}

function mapPermissions(raw: unknown): ProjectGuestPermissions {
  const obj = (raw ?? {}) as Record<string, unknown>;
  return {
    comment: obj.comment !== false,
    create_task: obj.create_task !== false,
    edit_own_task: obj.edit_own_task !== false,
  };
}

function mapGuest(
  row: Record<string, unknown>,
  extras: Partial<ProjectGuest> = {},
  options: { includeInviteToken?: boolean } = {},
): ProjectGuest {
  const guest: ProjectGuest = {
    id: String(row.id),
    projectId: String(row.project_id),
    accountId: String(row.account_id),
    userId: (row.user_id as string | null) ?? null,
    invitedEmail: String(row.invited_email),
    invitedBy: String(row.invited_by),
    permissions: mapPermissions(row.permissions),
    status: row.status as ProjectGuest['status'],
    createdAt: String(row.created_at),
    acceptedAt: (row.accepted_at as string | null) ?? null,
    projectName: null,
    accountSlug: null,
    accountName: null,
    ...extras,
  };

  if (options.includeInviteToken !== false) {
    guest.inviteToken = String(row.invite_token);
  }

  return guest;
}

async function assertCanManageProject(accountId: string, projectId: string) {
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
  const { data: project } = await projectsTable(admin)
    .select('id, name, title, account_id')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (!project) throw new Error('Project not found');

  return {
    user,
    project: project as {
      id: string;
      name: string;
      title: string | null;
      account_id: string;
    },
  };
}

function buildAcceptUrl(token: string) {
  // Magic-link entry (same pattern as /join/accept for team invites).
  const path = pathsConfig.app.joinProjectGuestAccept.replace('[token]', token);
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return base ? `${base}${path}` : path;
}

export function buildProjectGuestAcceptUrl(token: string) {
  return buildAcceptUrl(token);
}

export function buildGuestProjectPath(projectId: string) {
  return pathsConfig.app.personalGuestProject.replace('[projectId]', projectId);
}

async function hydrateGuests(
  rows: Record<string, unknown>[],
  options: { includeInviteToken?: boolean } = {},
): Promise<ProjectGuest[]> {
  if (rows.length === 0) return [];

  const admin = getSupabaseServerAdminClient();
  const projectIds = [...new Set(rows.map((r) => String(r.project_id)))];
  const accountIds = [...new Set(rows.map((r) => String(r.account_id)))];

  const [{ data: projects }, { data: accounts }] = await Promise.all([
    projectsTable(admin).select('id, name, title').in('id', projectIds),
    admin.from('accounts').select('id, slug, name').in('id', accountIds),
  ]);

  const projectById = new Map(
    ((projects ?? []) as Array<Record<string, unknown>>).map((p) => [
      String(p.id),
      p,
    ]),
  );
  const accountById = new Map(
    ((accounts ?? []) as Array<Record<string, unknown>>).map((a) => [
      String(a.id),
      a,
    ]),
  );

  return rows.map((row) => {
    const project = projectById.get(String(row.project_id));
    const account = accountById.get(String(row.account_id));
    const projectName =
      ((project?.title as string | null) ?? '').trim() ||
      ((project?.name as string | null) ?? '').trim() ||
      null;

    return mapGuest(
      row,
      {
        projectName,
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

export async function listProjectGuests(
  accountId: string,
  projectId: string,
): Promise<ProjectGuest[]> {
  await assertCanManageProject(accountId, projectId);
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await guestsTable(admin)
    .select('*')
    .eq('project_id', projectId)
    .eq('account_id', accountId)
    .in('status', ['pending', 'accepted', 'revoked'])
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return hydrateGuests((data ?? []) as Record<string, unknown>[], {
    includeInviteToken: false,
  });
}

export async function getProjectGuestByToken(
  token: string,
): Promise<ProjectGuest | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await guestsTable(admin)
    .select('*')
    .eq('invite_token', token)
    .maybeSingle();

  if (error || !data) return null;
  const [guest] = await hydrateGuests([data as Record<string, unknown>]);
  return guest ?? null;
}

export async function listAcceptedGuestsForUser(
  userId: string,
): Promise<ProjectGuest[]> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await guestsTable(admin)
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('accepted_at', { ascending: false });

  if (error) {
    console.warn('[project-guests] list for user:', error.message);
    return [];
  }

  return hydrateGuests((data ?? []) as Record<string, unknown>[], {
    includeInviteToken: false,
  });
}

export async function createProjectGuestInvite(input: {
  accountId: string;
  accountSlug: string;
  projectId: string;
  email: string;
  permissions?: Partial<ProjectGuestPermissions>;
}): Promise<{
  guest: ProjectGuest;
  acceptUrl: string;
  emailSent: boolean;
  emailError?: string;
}> {
  const { user, project } = await assertCanManageProject(
    input.accountId,
    input.projectId,
  );

  const email = input.email.trim().toLowerCase();
  if (!email || !email.includes('@')) {
    throw new Error('Enter a valid email address');
  }

  const permissions: ProjectGuestPermissions = {
    ...DEFAULT_PERMISSIONS,
    ...input.permissions,
  };

  if (
    !permissions.comment &&
    !permissions.create_task &&
    !permissions.edit_own_task
  ) {
    throw new Error('Select at least one permission');
  }

  const admin = getSupabaseServerAdminClient();
  const inviteToken = createSupportPublicToken(24);

  // Revive a revoked row for the same email, or insert fresh.
  const { data: existing } = await guestsTable(admin)
    .select('*')
    .eq('project_id', input.projectId)
    .eq('invited_email', email)
    .maybeSingle();

  let row: Record<string, unknown>;

  if (existing) {
    const { data, error } = await guestsTable(admin)
      .update({
        status: 'pending',
        permissions,
        invited_by: user.id,
        invite_token: inviteToken,
        user_id: null,
        accepted_at: null,
      })
      .eq('id', (existing as { id: string }).id)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    row = data as Record<string, unknown>;
  } else {
    const { data, error } = await guestsTable(admin)
      .insert({
        project_id: input.projectId,
        account_id: input.accountId,
        invited_email: email,
        invited_by: user.id,
        permissions,
        status: 'pending',
        invite_token: inviteToken,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    row = data as Record<string, unknown>;
  }

  const [guest] = await hydrateGuests([row]);
  if (!guest?.inviteToken) throw new Error('Failed to create invite');

  const acceptUrl = buildAcceptUrl(guest.inviteToken);
  const projectLabel =
    project.title?.trim() || project.name.trim() || 'a project';
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const from = resolveTransactionalEmailFrom(productName);

  let emailSent = false;
  let emailError: string | undefined;

  if (from) {
    const html = wrapNotificationEmail(
      `<p style="margin:0 0 12px;">You have been invited to collaborate on <strong>${escapeNotificationHtml(projectLabel)}</strong> in ${escapeNotificationHtml(productName)}.</p>
      <p style="margin:0 0 12px;font-size:13px;color:#5A4450;">You will only see that project's task board — not clients, invoices, or other workspace settings.</p>
      <p style="margin:0;font-size:13px;color:#5A4450;">Or open this link:<br /><a href="${escapeNotificationHtml(acceptUrl)}" style="color:#FF5C34;word-break:break-all;">${escapeNotificationHtml(acceptUrl)}</a></p>`,
      {
        productName,
        title: 'Project guest invite',
        heading: "You've been invited as a project guest",
        preview: `Collaborate on ${projectLabel}`,
        cta: { label: 'Accept invite', href: acceptUrl },
        footerNote: `You're receiving this because someone invited you to a project on ${escapeNotificationHtml(productName)}.`,
      },
    );

    try {
      await sendPlatformEmail({
        type: 'invitation',
        accountId: input.accountId,
        mail: {
          to: email,
          from,
          subject: `Invite to collaborate on ${projectLabel}`,
          html,
        },
        metadata: {
          kind: 'project_guest',
          projectId: input.projectId,
          guestId: guest.id,
        },
      });
      emailSent = true;
    } catch (error) {
      emailError = formatEmailDeliveryError(error);
      console.error('[project-guests] email failed', emailError, error);
    }
  } else {
    emailError =
      'No email sender configured (set ZEPTOMAIL_FROM_ADDRESS or EMAIL_SENDER).';
    console.warn('[project-guests]', emailError);
  }

  void input.accountSlug;
  return { guest, acceptUrl, emailSent, emailError };
}

export async function acceptProjectGuestInvite(
  token: string,
): Promise<ProjectGuest> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) throw new Error('Authentication required');

  const guest = await getProjectGuestByToken(token);
  if (!guest) throw new Error('Invite not found');
  if (guest.status === 'revoked') throw new Error('This invite was revoked');

  const email = user.email.trim().toLowerCase();
  if (email !== guest.invitedEmail.toLowerCase()) {
    throw new Error('Sign in with the email address this invite was sent to');
  }

  if (guest.status === 'accepted' && guest.userId === user.id) {
    return guest;
  }

  const admin = getSupabaseServerAdminClient();
  const { data, error } = await guestsTable(admin)
    .update({
      status: 'accepted',
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('id', guest.id)
    .eq('status', 'pending')
    .select('*')
    .maybeSingle();

  if (error) throw new Error(error.message);

  // Already accepted by this user under a race — re-read
  if (!data) {
    const again = await getProjectGuestByToken(token);
    if (again?.status === 'accepted' && again.userId === user.id) {
      return again;
    }
    throw new Error('Could not accept invite');
  }

  const [updated] = await hydrateGuests([data as Record<string, unknown>]);
  if (!updated) throw new Error('Could not accept invite');
  return updated;
}

export async function revokeProjectGuest(input: {
  accountId: string;
  projectId: string;
  guestId: string;
}): Promise<void> {
  await assertCanManageProject(input.accountId, input.projectId);
  const admin = getSupabaseServerAdminClient();
  const { error } = await guestsTable(admin)
    .update({ status: 'revoked' })
    .eq('id', input.guestId)
    .eq('project_id', input.projectId)
    .eq('account_id', input.accountId);

  if (error) throw new Error(error.message);
}

/** Link any pending invites matching the signed-in user's email (post-signup). */
export async function linkPendingProjectGuestsForUser(): Promise<number> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user?.email) return 0;

  const email = user.email.trim().toLowerCase();
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await guestsTable(admin)
    .update({
      status: 'accepted',
      user_id: user.id,
      accepted_at: new Date().toISOString(),
    })
    .eq('invited_email', email)
    .eq('status', 'pending')
    .is('user_id', null)
    .select('id');

  if (error) {
    console.warn('[project-guests] link pending:', error.message);
    return 0;
  }

  return (data ?? []).length;
}
