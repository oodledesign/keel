import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

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

const INK = '#351E28';
const MUTED = '#6B5B63';
const LINE = '#E7D7CC';

function readableInk(hex: string) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!match) return '#ffffff';
  const raw = match[1]!;
  const full =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw;
  const r = Number.parseInt(full.slice(0, 2), 16) / 255;
  const g = Number.parseInt(full.slice(2, 4), 16) / 255;
  const b = Number.parseInt(full.slice(4, 6), 16) / 255;
  const channel = (value: number) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  const luminance =
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.55 ? INK : '#ffffff';
}

function safeAccent(value: string) {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : '#FF5C34';
}

function button(href: string, label: string, accent: string) {
  const bg = safeAccent(accent);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:20px 0 4px;"><tr><td style="border-radius:10px;background:${bg};"><a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 26px;font-weight:700;font-size:15px;color:${readableInk(bg)};text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a></td></tr></table>`;
}

function formatDay(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function formatClock(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
}

function zoneName(iso: string, timeZone: string) {
  return (
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(new Date(iso))
      .find((part) => part.type === 'timeZoneName')?.value ?? timeZone
  );
}

function card(inner: string) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${LINE};border-radius:14px;background:#FBF6EC;margin:16px 0;"><tr><td style="padding:16px 18px;">${inner}</td></tr></table>`;
}

function eyebrow(text: string) {
  return `<p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${MUTED};">${escapeHtml(text)}</p>`;
}

function heading(text: string) {
  return `<h1 style="margin:0 0 14px;font-size:22px;line-height:1.25;color:${INK};">${escapeHtml(text)}</h1>`;
}

function slotList(
  slots: Array<{ startsAt: string }>,
  timeZone: string,
  max = 8,
) {
  const shown = slots.slice(0, max);
  const days = new Map<string, string[]>();
  for (const slot of shown) {
    const day = formatDay(slot.startsAt, timeZone);
    const times = days.get(day) ?? [];
    times.push(formatClock(slot.startsAt, timeZone));
    days.set(day, times);
  }
  const rows = [...days.entries()]
    .map(([day, times]) => {
      const pills = times
        .map(
          (time) =>
            `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 11px;border:1px solid ${LINE};border-radius:999px;background:#FFFFFF;font-size:13px;font-weight:600;color:${INK};">${escapeHtml(time)}</span>`,
        )
        .join('');
      return `<tr><td style="padding:10px 0 4px;border-top:1px solid ${LINE};"><div style="margin:0 0 6px;font-size:14px;font-weight:700;color:${INK};">${escapeHtml(day)}</div>${pills}</td></tr>`;
    })
    .join('');
  const more =
    slots.length > max
      ? `<tr><td style="padding:7px 0;border-top:1px solid ${LINE};font-size:13px;color:${MUTED};">+ ${slots.length - max} more on the poll</td></tr>`
      : '';
  const zone = slots[0] ? zoneName(slots[0].startsAt, timeZone) : timeZone;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows}${more}</table><p style="margin:8px 0 0;font-size:12px;color:${MUTED};">Times in ${escapeHtml(zone)} (${escapeHtml(timeZone)}). Your poll page shows them in your own timezone.</p>`;
}

function firstName(name: string | null | undefined) {
  return name?.trim().split(/\s+/)[0] ?? '';
}

function greeting(name: string | null | undefined) {
  const first = firstName(name);
  return `<p style="margin:0 0 14px;font-size:15px;color:${INK};">${first ? `Hi ${escapeHtml(first)},` : 'Hi,'}</p>`;
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
  timezone: string;
  slots: Array<{ startsAt: string }>;
  organiserName: string;
  replyTo: string | null;
  invitees: InviteeMail[];
  /** Everyone on the poll, including people not emailed in this batch. */
  totalInvitees: number;
}): Promise<PollMailResult> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const who = input.organiserName.trim() || workspaceName;
  const others = Math.max(0, input.totalInvitees - 1);

  return settle(
    input.invitees.map((invitee) => invitee.email),
    async (email) => {
      const invitee = input.invitees.find((row) => row.email === email);
      if (!invitee) return;
      const href = pollHref(invitee.token);
      const inner = `
        ${eyebrow('Pick a time')}
        ${heading(input.title)}
        ${greeting(invitee.name)}
        <p style="margin:0 0 14px;font-size:15px;color:${INK};"><strong>${escapeHtml(who)}</strong> would like to find a time that works for everyone. It is a ${input.durationMinutes} minute meeting${
          others > 0
            ? `, and ${others === 1 ? '1 other person has' : `${others} other people have`} been asked too`
            : ''
        }.</p>
        ${input.description ? `<p style="margin:0 0 14px;font-size:14px;color:${MUTED};">${escapeHtml(input.description)}</p>` : ''}
        ${card(`${eyebrow('Suggested times')}${slotList(input.slots, input.timezone)}`)}
        <p style="margin:0;font-size:14px;color:${INK};">Mark each time <strong style="color:#166534;">Yes</strong>, <strong style="color:#92400E;">If need be</strong> or <strong style="color:#991B1B;">No</strong>. You can come back and change your answers any time until a time is chosen.</p>
        ${button(href, 'Choose your times', brand.accent_color)}
        <p style="margin:12px 0 0;font-size:12px;color:${MUTED};word-break:break-all;">Or open: ${escapeHtml(href)}<br />This link is private to you. Please do not forward it.</p>
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
  /** `new_times`: more times were added after the poll was sent. */
  reason?: 'waiting' | 'new_times';
}): Promise<PollMailResult> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const who = input.organiserName.trim() || workspaceName;
  const newTimes = input.reason === 'new_times';

  return settle(
    input.invitees.map((invitee) => invitee.email),
    async (email) => {
      const invitee = input.invitees.find((row) => row.email === email);
      if (!invitee) return;
      const href = pollHref(invitee.token);
      const inner = `
        ${eyebrow(newTimes ? 'New times added' : 'Reminder')}
        ${heading(input.title)}
        ${greeting(invitee.name)}
        <p style="margin:0;font-size:15px;color:${INK};">${newTimes ? `${escapeHtml(who)} has added more times to this poll. Please check them and mark the new ones.` : `${escapeHtml(who)} is still waiting on your times.`} It only takes a moment.</p>
        ${button(href, 'Choose your times', brand.accent_color)}
        <p style="margin:12px 0 0;font-size:12px;color:${MUTED};word-break:break-all;">Or open: ${escapeHtml(href)}</p>
      `;

      await sendOne({
        accountId: input.accountId,
        workspaceName,
        to: email,
        subject: newTimes
          ? `New times added: ${input.title}`
          : `Reminder: please vote on ${input.title}`,
        html: branded(brand, inner),
        replyTo: input.replyTo,
        metadata: {
          pollId: input.pollId,
          kind: newTimes ? 'meeting_poll_new_times' : 'meeting_poll_reminder',
        },
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

      const dayLong = new Intl.DateTimeFormat('en-GB', {
        timeZone: input.timezone,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date(input.startAt));
      const month = new Intl.DateTimeFormat('en-GB', {
        timeZone: input.timezone,
        month: 'short',
      })
        .format(new Date(input.startAt))
        .toUpperCase();
      const dayNum = new Intl.DateTimeFormat('en-GB', {
        timeZone: input.timezone,
        day: 'numeric',
      }).format(new Date(input.startAt));
      const range = `${formatClock(input.startAt, input.timezone)} to ${formatClock(input.endAt, input.timezone)} ${zoneName(input.startAt, input.timezone)}`;
      const isUrl = place ? /^https?:\/\//i.test(place) : false;
      const attendeeCount = input.invitees.length + 1;

      const inner = `
        ${eyebrow('Confirmed')}
        ${greeting(recipient.name)}
        <p style="margin:0 0 4px;font-size:15px;color:${INK};"><strong>${escapeHtml(input.title)}</strong> is booked in.</p>
        ${card(`
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
            <td width="68" valign="top">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="60" style="border:1px solid ${LINE};border-radius:10px;background:#ffffff;text-align:center;">
                <tr><td style="background:#166534;color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.08em;padding:4px 0;border-radius:9px 9px 0 0;">${escapeHtml(month)}</td></tr>
                <tr><td style="font-size:26px;font-weight:800;color:${INK};padding:6px 0;">${escapeHtml(dayNum)}</td></tr>
              </table>
            </td>
            <td valign="top" style="padding-left:6px;">
              <p style="margin:0;font-size:17px;font-weight:700;color:${INK};">${escapeHtml(dayLong)}</p>
              <p style="margin:2px 0 0;font-size:15px;color:${INK};">${escapeHtml(range)}</p>
              <p style="margin:8px 0 0;font-size:13px;color:${MUTED};">${attendeeCount} ${attendeeCount === 1 ? 'person' : 'people'} invited</p>
            </td>
          </tr></table>
        `)}
        ${place && isUrl ? button(place, 'Join the meeting', brand.accent_color) : ''}
        ${place && !isUrl ? `<p style="margin:0 0 8px;font-size:15px;color:${INK};"><strong>Where:</strong> ${escapeHtml(place)}</p>` : ''}
        ${input.description ? `<p style="margin:12px 0 0;font-size:14px;color:${MUTED};">${escapeHtml(input.description)}</p>` : ''}
        <p style="margin:16px 0 0;font-size:13px;color:${MUTED};">A calendar invite is attached. Open it to add this to your calendar.</p>
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

export async function sendPollResponseNotificationEmail(input: {
  accountId: string;
  pollId: string;
  title: string;
  timezone: string;
  hostEmail: string;
  hostName: string;
  responderName: string;
  completedCount: number;
  totalInvitees: number;
  bestSlots: Array<{
    startsAt: string;
    yes: number;
    ifNeedBe: number;
    no: number;
  }>;
  pollUrl: string;
}): Promise<void> {
  const { workspaceName, brand } = await workspaceIdentity(input.accountId);
  const waiting = Math.max(0, input.totalInvitees - input.completedCount);
  const who = firstName(input.responderName) || 'Someone';

  const pill = (text: string, bg: string, fg: string) =>
    `<span style="display:inline-block;padding:2px 9px;border-radius:999px;background:${bg};color:${fg};font-size:12px;font-weight:700;margin-left:4px;">${escapeHtml(text)}</span>`;

  const rows = input.bestSlots
    .map(
      (slot, index) => `
        <tr>
          <td style="padding:9px 0;border-top:1px solid ${LINE};font-size:14px;color:${INK};">
            <strong>${index + 1}. ${escapeHtml(formatDay(slot.startsAt, input.timezone))}, ${escapeHtml(formatClock(slot.startsAt, input.timezone))}</strong>
          </td>
          <td align="right" style="padding:9px 0;border-top:1px solid ${LINE};white-space:nowrap;">
            ${pill(`${slot.yes} yes`, '#DCFCE7', '#166534')}${slot.ifNeedBe > 0 ? pill(`${slot.ifNeedBe} if need be`, '#FEF3C7', '#92400E') : ''}${slot.no > 0 ? pill(`${slot.no} no`, '#FEE2E2', '#991B1B') : ''}
          </td>
        </tr>`,
    )
    .join('');

  const inner = `
    ${eyebrow('New response')}
    ${heading(`${who} has answered ${input.title}`)}
    ${greeting(input.hostName)}
    <p style="margin:0 0 4px;font-size:15px;color:${INK};"><strong>${input.completedCount} of ${input.totalInvitees}</strong> ${input.totalInvitees === 1 ? 'person has' : 'people have'} responded${
      waiting > 0
        ? `, and <strong>${waiting}</strong> ${waiting === 1 ? 'still needs' : 'still need'} to.`
        : '. Everyone has answered, so you can choose a time.'
    }</p>
    ${card(`${eyebrow('Best times right now')}<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border-collapse:collapse;">${rows}</table><p style="margin:8px 0 0;font-size:12px;color:${MUTED};">Times in ${escapeHtml(input.timezone)}. Ranked by most yes, then if need be.</p>`)}
    ${button(input.pollUrl, 'View responses and choose a time', brand.accent_color)}
  `;

  await sendOne({
    accountId: input.accountId,
    workspaceName,
    to: input.hostEmail,
    subject: `${who} answered ${input.title} (${input.completedCount}/${input.totalInvitees})`,
    html: branded(brand, inner),
    hostCopy: true,
    metadata: { pollId: input.pollId, kind: 'meeting_poll_response' },
  });
}
