import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { formatBookingWhenForEmail } from '~/book/_lib/calendar-links';
import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { escapeNotificationHtml } from '~/lib/email/wrap-notification-email';
import { getTransactionalEmailSender } from '~/lib/email/zeptomail-client';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import { buildPollRequestIcs, pollIcsAttachment } from './ics';

export type PollEmailFailure = { email: string; error: string };

export type PollMailResult = {
  sent: string[];
  failed: PollEmailFailure[];
};

type InviteeMail = {
  email: string;
  name: string | null;
  token: string;
};

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://app.ozer.so'
  );
}

function pollHref(token: string) {
  return `${siteUrl()}/poll/${token}`;
}

function escapeHtml(value: string) {
  return escapeNotificationHtml(value);
}

async function workspaceIdentity(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const [{ data: account }, brand] = await Promise.all([
    admin.from('accounts').select('name').eq('id', accountId).maybeSingle(),
    loadAccountBrandResolved(accountId),
  ]);

  return {
    workspaceName: account?.name?.trim() || 'Ozer',
    brand,
  };
}

function branded(
  brand: Awaited<ReturnType<typeof loadAccountBrandResolved>>,
  innerHtml: string,
) {
  return wrapEmailHtmlWithBrand({ brand, innerHtml });
}

async function sendOne(input: {
  accountId: string;
  workspaceName: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string | null;
  attachments?: Array<{ name: string; content: string; mimeType: string }>;
  hostCopy?: boolean;
  metadata: Record<string, unknown>;
}) {
  if (input.hostCopy) {
    await sendPlatformEmail({
      type: 'event',
      accountId: input.accountId,
      mail: {
        to: input.to,
        from: getTransactionalEmailSender(input.workspaceName),
        subject: input.subject,
        html: input.html,
        replyTo: input.replyTo ?? undefined,
        attachments: input.attachments,
      },
      metadata: input.metadata,
    });
    return;
  }

  await sendClientFacingEmail({
    type: 'event',
    accountId: input.accountId,
    feature: 'other',
    accountName: input.workspaceName,
    displayName: input.workspaceName,
    brandContactEmail: input.replyTo,
    mail: {
      to: input.to,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo ?? undefined,
      attachments: input.attachments,
    },
    metadata: input.metadata,
  });
}

async function settle(
  recipients: string[],
  send: (email: string) => Promise<void>,
): Promise<PollMailResult> {
  const sent: string[] = [];
  const failed: PollEmailFailure[] = [];

  for (const email of recipients) {
    try {
      await send(email);
      sent.push(email);
    } catch (error) {
      failed.push({
        email,
        error:
          error instanceof Error ? error.message : 'Email could not be sent',
      });
    }
  }

  return { sent, failed };
}

export async function sendPollInviteEmails(input: {
  accountId: string;
  pollId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  organiserName: string;
  replyTo: string | null;
  invitees: InviteeMail[];
}): Promise<PollMailResult> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const who = input.organiserName.trim() || workspaceName;

  return settle(
    input.invitees.map((invitee) => invitee.email),
    async (email) => {
      const invitee = input.invitees.find((row) => row.email === email);
      if (!invitee) return;
      const href = pollHref(invitee.token);
      const greeting = invitee.name?.trim()
        ? `Hi ${escapeHtml(invitee.name.trim())},`
        : 'Hi,';
      const inner = `
        <p style="margin:0 0 12px;">${greeting}</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(who)}</strong> invited you to pick a time for <strong>${escapeHtml(input.title)}</strong>.</p>
        ${input.description ? `<p style="margin:0 0 12px;">${escapeHtml(input.description)}</p>` : ''}
        <p style="margin:0 0 12px;">The meeting is ${input.durationMinutes} minutes. Open your private link to mark each time Yes, If need be, or No. You can change your answers later from the same link.</p>
        <p style="margin:16px 0;"><a href="${escapeHtml(href)}" style="color:${escapeHtml(brand.accent_color)};">Choose your times</a></p>
        <p style="margin:0;font-size:13px;word-break:break-all;">${escapeHtml(href)}</p>
      `;

      await sendOne({
        accountId: input.accountId,
        workspaceName,
        to: email,
        subject: `${who} invited you to pick a time: ${input.title}`,
        html: branded(brand, inner),
        replyTo: input.replyTo,
        metadata: { pollId: input.pollId, kind: 'meeting_poll_invite' },
      });
    },
  );
}

export async function sendPollReminderEmails(input: {
  accountId: string;
  pollId: string;
  title: string;
  organiserName: string;
  replyTo: string | null;
  invitees: InviteeMail[];
}): Promise<PollMailResult> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const who = input.organiserName.trim() || workspaceName;

  return settle(
    input.invitees.map((invitee) => invitee.email),
    async (email) => {
      const invitee = input.invitees.find((row) => row.email === email);
      if (!invitee) return;
      const href = pollHref(invitee.token);
      const inner = `
        <p style="margin:0 0 12px;">${invitee.name?.trim() ? `Hi ${escapeHtml(invitee.name.trim())},` : 'Hi,'}</p>
        <p style="margin:0 0 12px;">${escapeHtml(who)} is still waiting on your times for <strong>${escapeHtml(input.title)}</strong>.</p>
        <p style="margin:16px 0;"><a href="${escapeHtml(href)}" style="color:${escapeHtml(brand.accent_color)};">Vote now</a></p>
        <p style="margin:0;font-size:13px;word-break:break-all;">${escapeHtml(href)}</p>
      `;

      await sendOne({
        accountId: input.accountId,
        workspaceName,
        to: email,
        subject: `Reminder: please vote on ${input.title}`,
        html: branded(brand, inner),
        replyTo: input.replyTo,
        metadata: { pollId: input.pollId, kind: 'meeting_poll_reminder' },
      });
    },
  );
}

export async function sendPollConfirmationEmails(input: {
  accountId: string;
  pollId: string;
  title: string;
  description: string | null;
  location: string | null;
  timezone: string;
  startAt: string;
  endAt: string;
  conferencingUrl: string | null;
  organiserName: string;
  organiserEmail: string;
  invitees: Array<{ email: string; name: string | null }>;
}): Promise<PollMailResult> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const when = formatBookingWhenForEmail(input.startAt, input.timezone);
  const place = input.conferencingUrl || input.location;
  const ics = pollIcsAttachment(
    buildPollRequestIcs({
      uid: `meeting-poll-${input.pollId}@ozer.so`,
      title: input.title,
      description: [
        input.description,
        input.conferencingUrl ? `Join: ${input.conferencingUrl}` : null,
        `Scheduled with ${workspaceName}`,
      ]
        .filter(Boolean)
        .join('\n'),
      startAt: input.startAt,
      endAt: input.endAt,
      location: place,
      url: input.conferencingUrl,
      organizerEmail: input.organiserEmail,
      organizerName: input.organiserName || workspaceName,
      attendees: input.invitees,
    }),
  );

  const recipients = [
    { email: input.organiserEmail, name: input.organiserName, hostCopy: true },
    ...input.invitees.map((invitee) => ({ ...invitee, hostCopy: false })),
  ];

  const seen = new Set<string>();

  return settle(
    recipients.map((row) => row.email),
    async (email) => {
      const key = email.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      const recipient = recipients.find(
        (row) => row.email.toLowerCase() === key,
      );
      if (!recipient) return;

      const inner = `
        <p style="margin:0 0 12px;">${recipient.name?.trim() ? `Hi ${escapeHtml(recipient.name.trim())},` : 'Hi,'}</p>
        <p style="margin:0 0 12px;"><strong>${escapeHtml(input.title)}</strong> is confirmed.</p>
        <p style="margin:0 0 8px;"><strong>When:</strong> ${escapeHtml(when)}</p>
        ${place ? `<p style="margin:0 0 8px;"><strong>Where:</strong> ${escapeHtml(place)}</p>` : ''}
        ${input.description ? `<p style="margin:12px 0 0;">${escapeHtml(input.description)}</p>` : ''}
        <p style="margin:16px 0 0;">A calendar invite is attached.</p>
      `;

      await sendOne({
        accountId: input.accountId,
        workspaceName,
        to: recipient.email,
        subject: `Confirmed: ${input.title}`,
        html: branded(brand, inner),
        replyTo: input.organiserEmail,
        attachments: [ics],
        hostCopy: recipient.hostCopy,
        metadata: { pollId: input.pollId, kind: 'meeting_poll_confirmation' },
      });
    },
  );
}
