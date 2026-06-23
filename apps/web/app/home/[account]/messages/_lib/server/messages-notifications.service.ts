import 'server-only';

import { createNotificationsApi } from '@kit/notifications/api';
import type { SupabaseClient } from '@supabase/supabase-js';

import { sendPlatformEmail } from '~/lib/server/send-platform-email';
import { formatUkDateTime } from '~/lib/format/uk-datetime';
import pathsConfig from '~/config/paths.config';

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(0, max - 1))}…`;
}

function formatDateTime(iso: string) {
  return formatUkDateTime(iso, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatShortTime(iso: string) {
  return formatUkDateTime(iso, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

type UserMetadata = Record<string, unknown> | null | undefined;

type UserIdentity = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
};

function prettifyEmailLocalPart(local: string): string {
  const cleaned = local.replace(/[._+-]+/g, ' ').trim();
  if (!cleaned) return '';
  return cleaned
    .split(/\s+/)
    .map((token) =>
      token.length > 0
        ? token[0]!.toUpperCase() + token.slice(1).toLowerCase()
        : '',
    )
    .join(' ');
}

function pickDisplayName(identity: UserIdentity): string {
  const parts = [identity.firstName, identity.lastName]
    .map((p) => (p ?? '').trim())
    .filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  if (identity.fullName && identity.fullName.trim()) {
    return identity.fullName.trim();
  }
  if (identity.email) {
    const local = identity.email.split('@')[0] ?? '';
    const pretty = prettifyEmailLocalPart(local);
    if (pretty) return pretty;
    if (identity.email.trim()) return identity.email.trim();
  }
  return 'Someone';
}

function pickFirstName(identity: UserIdentity): string {
  if (identity.firstName && identity.firstName.trim()) {
    return identity.firstName.trim();
  }
  if (identity.fullName && identity.fullName.trim()) {
    const firstToken = identity.fullName.trim().split(/\s+/)[0];
    if (firstToken) return firstToken;
  }
  if (identity.email) {
    const local = identity.email.split('@')[0] ?? '';
    const pretty = prettifyEmailLocalPart(local);
    if (pretty) {
      const firstToken = pretty.split(/\s+/)[0];
      if (firstToken) return firstToken;
    }
  }
  return 'Someone';
}

function buildIdentity(opts: {
  userId: string;
  settingsRow?: { first_name: string | null; last_name: string | null } | null;
  personalAccountName?: string | null;
  meta?: UserMetadata;
  email?: string | null;
}): UserIdentity {
  const meta = (opts.meta ?? {}) as Record<string, unknown>;
  const metaFirst = String(meta.first_name ?? '').trim();
  const metaLast = String(meta.last_name ?? '').trim();
  const metaFull =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';

  const settingsFirst = (opts.settingsRow?.first_name ?? '').trim();
  const settingsLast = (opts.settingsRow?.last_name ?? '').trim();

  let firstName: string | null = settingsFirst || metaFirst || null;
  let lastName: string | null = settingsLast || metaLast || null;
  const fullName: string | null =
    (opts.personalAccountName ?? '').trim() || metaFull || null;

  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
      firstName = parts[0] ?? null;
      if (!lastName && parts.length > 1) {
        lastName = parts.slice(1).join(' ');
      }
    }
  }

  return {
    userId: opts.userId,
    firstName,
    lastName,
    fullName: fullName ?? null,
    email: opts.email ?? null,
  };
}

export function createMessagesNotificationsService(client: SupabaseClient) {
  return new MessagesNotificationsService(client);
}

type RecentMessageRow = {
  id: string;
  sender_user_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
};

class MessagesNotificationsService {
  constructor(private readonly client: SupabaseClient) {}

  private async logEmailAttempt(params: {
    organisationId: string;
    senderUserId: string;
    threadId: string;
    recipientEmail: string;
    status: 'sent' | 'failed' | 'skipped';
    skipReason?: string;
    subject?: string | null;
    body?: string;
    sentAt?: string;
  }) {
    if (params.status === 'failed') {
      console.warn('[messages] email attempt failed', {
        threadId: params.threadId,
        recipientEmail: params.recipientEmail,
        reason: params.skipReason ?? params.body,
      });
    }
  }

  async notifyOnMessage(params: {
    accountId: string;
    accountSlug: string;
    threadId: string;
    senderUserId: string;
    messageBody: string;
  }) {
    const { data: participants } = await this.client
      .from('chat_thread_participants')
      .select('participant_kind, participant_user_id, participant_client_id')
      .eq('thread_id', params.threadId)
      .is('archived_at', null);

    const explicitMemberUserIds = (participants ?? [])
      .filter((p: any) => p.participant_kind === 'member')
      .map((p: any) => p.participant_user_id)
      .filter(Boolean) as string[];

    const clientIds = (participants ?? [])
      .filter((p: any) => p.participant_kind === 'client')
      .map((p: any) => p.participant_client_id)
      .filter(Boolean) as string[];

    const clientRows = clientIds.length
      ? (
          await this.client
            .from('clients')
            .select('id, display_name, company_name, first_name, last_name')
            .in('id', clientIds)
        ).data ?? []
      : [];

    const { data: clientContactRows } =
      clientIds.length > 0
        ? await this.client
            .from('client_contacts')
            .select('client_id, is_primary, created_at, contacts ( email )')
            .in('client_id', clientIds)
            .order('is_primary', { ascending: false })
            .order('created_at', { ascending: true })
        : { data: [] as Array<{
            client_id: string;
            is_primary: boolean | null;
            contacts: { email: string | null } | null;
          }> };

    const contactEmailByClientId = new Map<string, string>();
    for (const row of clientContactRows ?? []) {
      const email = row.contacts?.email?.trim();
      if (!email || contactEmailByClientId.has(row.client_id)) continue;
      contactEmailByClientId.set(row.client_id, email);
    }

    const clientEmails = clientRows
      .map((row: any) => contactEmailByClientId.get(row.id as string) ?? null)
      .filter(Boolean) as string[];

    const clientMemberUserIdsRaw =
      clientEmails.length > 0
        ? (
            await this.client
              .from('accounts_memberships')
              .select('user_id, account_role')
              .eq('account_id', params.accountId)
              .eq('account_role', 'client')
          ).data ?? []
        : [];

    const clientEmailSet = new Set(
      clientEmails.map((email) => email.toLowerCase()),
    );

    // Load all users once — we need them for member->email mapping, sender
    // labels, and recipient resolution. The 1000 page cap is an acceptable
    // limit for current scale; revisit if we outgrow it.
    const allUsers = (
      await this.client.auth.admin.listUsers({ page: 1, perPage: 1000 })
    ).data.users;
    const userById = new Map<string, any>(allUsers.map((u: any) => [u.id, u]));

    let clientMemberUserIds: string[] = [];
    if (clientMemberUserIdsRaw.length > 0 && clientEmailSet.size > 0) {
      clientMemberUserIds = clientMemberUserIdsRaw
        .map((row: any) => row.user_id as string)
        .filter((userId: string) => {
          const user = userById.get(userId);
          return user?.email ? clientEmailSet.has(user.email.toLowerCase()) : false;
        });
    }

    const allMemberUserIds = Array.from(
      new Set([...explicitMemberUserIds, ...clientMemberUserIds]),
    );
    const recipientUserIds = allMemberUserIds.filter(
      (id) => id !== params.senderUserId,
    );

    const link = pathsConfig.app.accountMessages
      .replace('[account]', params.accountSlug) + `?thread=${params.threadId}`;
    const notificationsApi = createNotificationsApi(this.client as any);
    for (const userId of recipientUserIds) {
      try {
        await notificationsApi.createNotification({
          account_id: userId,
          channel: 'in_app',
          type: 'info',
          body: 'New message received',
          link,
        } as any);
      } catch (notificationError) {
        console.warn('[messages] in-app notification insert failed', {
          threadId: params.threadId,
          recipientUserId: userId,
          error:
            notificationError instanceof Error
              ? notificationError.message
              : String(notificationError),
        });
      }
    }

    const recipientMemberEmails = recipientUserIds
      .map((id) => userById.get(id)?.email)
      .filter(Boolean) as string[];

    const recipientEmails = Array.from(
      new Set([...recipientMemberEmails, ...clientEmails]),
    ) as string[];

    const sender =
      process.env.EMAIL_SENDER?.trim() ||
      process.env.SES_FROM_ADDRESS?.trim() ||
      null;
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim() || null;

    const auditEmail =
      userById.get(params.senderUserId)?.email?.trim() ||
      recipientEmails[0] ||
      'notification-audit@keel.internal';

    if (!sender || !siteUrl || recipientEmails.length === 0) {
      const skipReason = !sender
        ? 'missing_env_email_sender_and_ses_from'
        : !siteUrl
          ? 'missing_env_site_url'
          : 'no_recipients';

      console.warn('[messages] skipping email notification', {
        accountId: params.accountId,
        threadId: params.threadId,
        reason: skipReason,
        recipientCount: recipientEmails.length,
        hasEmailSender: Boolean(process.env.EMAIL_SENDER?.trim()),
        hasSesFrom: Boolean(process.env.SES_FROM_ADDRESS?.trim()),
        hasSiteUrl: Boolean(siteUrl),
        memberRecipients: recipientUserIds.length,
        clientEmails: clientEmails.length,
      });

      await this.logEmailAttempt({
        organisationId: params.accountId,
        senderUserId: params.senderUserId,
        threadId: params.threadId,
        recipientEmail: auditEmail,
        status: 'skipped',
        skipReason,
        subject: 'Chat notification (skipped)',
        body: JSON.stringify({
          recipientEmails,
          recipientUserIds,
          clientEmails,
        }),
      });

      return;
    }

    // Resolve thread metadata (title, type, linked job) for email header.
    const { data: thread } = await this.client
      .from('chat_threads')
      .select('id, type, title, job_id')
      .eq('id', params.threadId)
      .maybeSingle();

    let linkedJobTitle: string | null = null;
    if (thread?.job_id) {
      const { data: job } = await this.client
        .from('jobs')
        .select('title')
        .eq('id', thread.job_id)
        .maybeSingle();
      linkedJobTitle = (job?.title as string | undefined) ?? null;
    }

    // Load up to 11 most-recent messages (the just-sent one plus up to 10
    // prior), displayed oldest -> newest in the email body.
    const { data: recentDesc } = await this.client
      .from('chat_messages')
      .select('id, sender_user_id, body, image_url, created_at')
      .eq('thread_id', params.threadId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(11);

    const recentMessages = ((recentDesc ?? []) as RecentMessageRow[])
      .slice()
      .reverse();
    // The newest message is the one we just inserted; "previous messages" in
    // the email body should be everything before it (up to 10).
    const newestMessage: RecentMessageRow | undefined =
      recentMessages[recentMessages.length - 1];
    const previousMessages: RecentMessageRow[] = newestMessage
      ? recentMessages.slice(0, -1)
      : recentMessages;

    // Build identity map for every unique user we'll need a display name for:
    // message senders (new + history) plus every thread member (for the
    // participant-summary fallback title).
    const participantMemberIds = (participants ?? [])
      .filter(
        (p: any) =>
          p.participant_kind === 'member' && p.participant_user_id,
      )
      .map((p: any) => p.participant_user_id as string);
    const identityUserIds = Array.from(
      new Set([
        params.senderUserId,
        ...recentMessages.map((m) => m.sender_user_id),
        ...participantMemberIds,
      ]),
    );

    // Load canonical display-name sources. Prefer public.user_settings
    // (first_name / last_name set during onboarding), then the personal
    // account's name, then auth metadata / email.
    const [settingsRes, accountNamesRes] = await Promise.all([
      identityUserIds.length > 0
        ? this.client
            .from('user_settings')
            .select('user_id, first_name, last_name')
            .in('user_id', identityUserIds)
        : Promise.resolve({ data: [] } as any),
      identityUserIds.length > 0
        ? this.client
            .from('accounts')
            .select('primary_owner_user_id, name')
            .eq('is_personal_account', true)
            .in('primary_owner_user_id', identityUserIds)
        : Promise.resolve({ data: [] } as any),
    ]);

    const settingsByUserId = new Map<
      string,
      { first_name: string | null; last_name: string | null }
    >();
    for (const row of (settingsRes.data ?? []) as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
    }>) {
      settingsByUserId.set(row.user_id, {
        first_name: row.first_name,
        last_name: row.last_name,
      });
    }

    const personalAccountNameByUserId = new Map<string, string>();
    for (const row of (accountNamesRes.data ?? []) as Array<{
      primary_owner_user_id: string;
      name: string | null;
    }>) {
      if (row.name) {
        personalAccountNameByUserId.set(row.primary_owner_user_id, row.name);
      }
    }

    const identityByUserId = new Map<string, UserIdentity>();
    for (const id of identityUserIds) {
      const u = userById.get(id);
      identityByUserId.set(
        id,
        buildIdentity({
          userId: id,
          settingsRow: settingsByUserId.get(id) ?? null,
          personalAccountName: personalAccountNameByUserId.get(id) ?? null,
          meta: (u?.user_metadata as UserMetadata) ?? null,
          email: u?.email ?? null,
        }),
      );
    }

    const labelBySenderId = new Map<string, string>();
    for (const [id, identity] of identityByUserId.entries()) {
      labelBySenderId.set(id, pickDisplayName(identity));
    }

    const participantRowsAll = participants ?? [];

    const senderIdentity =
      identityByUserId.get(params.senderUserId) ??
      buildIdentity({
        userId: params.senderUserId,
        settingsRow: settingsByUserId.get(params.senderUserId) ?? null,
        personalAccountName:
          personalAccountNameByUserId.get(params.senderUserId) ?? null,
        meta:
          (userById.get(params.senderUserId)?.user_metadata as UserMetadata) ??
          null,
        email: userById.get(params.senderUserId)?.email ?? null,
      });
    const senderLabel = pickDisplayName(senderIdentity);
    const senderFirstName = pickFirstName(senderIdentity);

    // Thread title shown in email body and subject context.
    const rawTitle = (thread?.title ?? '').trim();
    const participantDisplayNames = Array.from(
      new Set(
        (participantRowsAll as any[])
          .map((row) => {
            if (row.participant_kind === 'member' && row.participant_user_id) {
              return labelBySenderId.get(row.participant_user_id) ?? null;
            }
            if (row.participant_kind === 'client' && row.participant_client_id) {
              const c = clientRows.find(
                (r: any) => r.id === row.participant_client_id,
              );
              return (c?.display_name ?? c?.company_name ?? null) as
                | string
                | null;
            }
            return null;
          })
          .filter((v): v is string => Boolean(v && v.trim())),
      ),
    );
    const participantSummary =
      participantDisplayNames.length > 0
        ? truncate(participantDisplayNames.join(', '), 80)
        : 'Conversation';
    const threadTitle =
      rawTitle ||
      (thread?.type === 'job' && linkedJobTitle ? linkedJobTitle : '') ||
      participantSummary;

    const newMessageCreatedAt =
      newestMessage?.created_at ?? new Date().toISOString();
    const newMessageTimeLabel = formatDateTime(newMessageCreatedAt);

    const subject = truncate(
      `New message from ${senderFirstName} in Tradeways`,
      70,
    );
    const conversationUrl = `${siteUrl}${link}`;

    const html = buildChatNotificationEmailHtml({
      threadTitle,
      threadTypeLabel: threadTypeLabel(thread?.type ?? null, Boolean(thread?.job_id)),
      senderLabel,
      newMessageBody: params.messageBody,
      newMessageTimeLabel,
      previousMessages: previousMessages.map((m) => ({
        id: m.id,
        senderLabel: labelBySenderId.get(m.sender_user_id) ?? 'Someone',
        time: formatShortTime(m.created_at),
        body: m.body,
        hasImage: Boolean(m.image_url),
      })),
      conversationUrl,
    });

    try {
      for (const email of recipientEmails) {
        try {
          await sendPlatformEmail({
            type: 'message',
            accountId: params.accountId,
            mail: {
              from: sender,
              to: email,
              subject,
              html,
            },
            metadata: { threadId: params.threadId },
          });

          await this.logEmailAttempt({
            organisationId: params.accountId,
            senderUserId: params.senderUserId,
            threadId: params.threadId,
            recipientEmail: email,
            status: 'sent',
            subject,
            body: html,
            sentAt: new Date().toISOString(),
          });
        } catch (sendError) {
          const message =
            sendError instanceof Error ? sendError.message : String(sendError);

          console.error('[messages] failed to send notification email', {
            threadId: params.threadId,
            to: email,
            error: message,
          });

          await this.logEmailAttempt({
            organisationId: params.accountId,
            senderUserId: params.senderUserId,
            threadId: params.threadId,
            recipientEmail: email,
            status: 'failed',
            skipReason: message,
            subject,
            body: html,
          });
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[messages] failed to initialize mailer', {
        threadId: params.threadId,
        error: message,
      });

      for (const email of recipientEmails) {
        await this.logEmailAttempt({
          organisationId: params.accountId,
          senderUserId: params.senderUserId,
          threadId: params.threadId,
          recipientEmail: email,
          status: 'failed',
          skipReason: `mailer_init: ${message}`,
          subject,
          body: html,
        });
      }
    }
  }
}

function threadTypeLabel(
  type: string | null,
  hasJob: boolean,
): string {
  if (type === 'job' || hasJob) return 'Job thread';
  if (type === 'group') return 'Group chat';
  if (type === 'direct') return 'Direct message';
  return 'Conversation';
}

function buildChatNotificationEmailHtml(params: {
  threadTitle: string;
  threadTypeLabel: string;
  senderLabel: string;
  newMessageBody: string;
  newMessageTimeLabel: string;
  previousMessages: Array<{
    id: string;
    senderLabel: string;
    time: string;
    body: string;
    hasImage: boolean;
  }>;
  conversationUrl: string;
}) {
  const {
    threadTitle,
    threadTypeLabel: typeLabel,
    senderLabel,
    newMessageBody,
    newMessageTimeLabel,
    previousMessages,
    conversationUrl,
  } = params;

  const safeTitle = escapeHtml(truncate(threadTitle, 120));
  const safeType = escapeHtml(typeLabel);
  const safeSender = escapeHtml(senderLabel);
  const safeTime = escapeHtml(newMessageTimeLabel);
  const safeUrl = escapeHtml(conversationUrl);

  const newBodyHtml = (() => {
    const body = newMessageBody?.trim() || 'Sent an image';
    return escapeHtml(truncate(body, 2000)).replaceAll('\n', '<br />');
  })();

  const historyRowsHtml = previousMessages
    .map((msg, index) => {
      const bodyText =
        msg.body?.trim() || (msg.hasImage ? 'Image attachment' : '');
      const safeBody = escapeHtml(truncate(bodyText, 400)).replaceAll(
        '\n',
        '<br />',
      );
      const attachmentLine = msg.hasImage
        ? '<div style="margin-top:4px;font-size:12px;color:#7E889D;">(image attached)</div>'
        : '';
      const topBorder = index === 0 ? 'none' : '1px solid #E3E8F0';
      return `
        <tr>
          <td style="padding:10px 14px;border-top:${topBorder};background:#FFFFFF;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
              <tr>
                <td style="font-family:Poppins,Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#465B6F;line-height:1.3;">
                  ${escapeHtml(msg.senderLabel)}
                </td>
                <td align="right" style="font-family:Poppins,Arial,Helvetica,sans-serif;font-size:11px;color:#7E889D;line-height:1.3;white-space:nowrap;">
                  ${escapeHtml(msg.time)}
                </td>
              </tr>
              <tr>
                <td colspan="2" style="padding-top:4px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:13px;color:#0F172A;line-height:1.55;word-break:break-word;">
                  ${safeBody || '&nbsp;'}
                  ${attachmentLine}
                </td>
              </tr>
            </table>
          </td>
        </tr>
      `;
    })
    .join('\n');

  const historySectionHtml =
    previousMessages.length > 0
      ? `
          <tr>
            <td style="padding:4px 24px 8px 24px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;color:#7E889D;letter-spacing:0.04em;text-transform:uppercase;">
              Previous messages (last ${previousMessages.length})
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 20px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid #E3E8F0;border-radius:10px;overflow:hidden;">
                ${historyRowsHtml}
              </table>
            </td>
          </tr>
        `
      : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#F4F6FA;font-family:Poppins,Arial,Helvetica,sans-serif;color:#0F172A;">
    <div style="display:none;font-size:1px;color:#F4F6FA;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
      New message from ${safeSender} in ${safeTitle}
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F6FA;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:1px solid #E3E8F0;border-radius:16px;box-shadow:0 1px 2px rgba(15,23,42,0.05);">
            <tr>
              <td style="padding:20px 24px 16px 24px;border-bottom:1px solid #E3E8F0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="font-family:Poppins,Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#57C87F;">
                      Tradeways · ${safeType}
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:6px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0F172A;line-height:1.3;">
                      ${safeTitle}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 24px 8px 24px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F8FAFC;border:1px solid #E3E8F0;border-left:3px solid #57C87F;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="font-family:Poppins,Arial,Helvetica,sans-serif;font-size:13px;font-weight:600;color:#1F7F7F;line-height:1.3;">
                            ${safeSender}
                          </td>
                          <td align="right" style="font-family:Poppins,Arial,Helvetica,sans-serif;font-size:11px;color:#7E889D;line-height:1.3;white-space:nowrap;">
                            ${safeTime}
                          </td>
                        </tr>
                        <tr>
                          <td colspan="2" style="padding-top:8px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;color:#0F172A;line-height:1.6;word-break:break-word;">
                            ${newBodyHtml}
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 4px 24px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="border-radius:10px;background:#57C87F;">
                      <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:11px 20px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:14px;font-weight:600;color:#060C18;text-decoration:none;border-radius:10px;">
                        Open conversation
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            ${historySectionHtml}
            <tr>
              <td style="padding:0 24px 20px 24px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:11px;color:#7E889D;line-height:1.5;">
                You’re receiving this because you’re a participant in this chat.
                <br />
                Replies to this email aren’t delivered — open the conversation to respond.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
