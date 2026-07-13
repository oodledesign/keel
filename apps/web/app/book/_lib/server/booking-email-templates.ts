import 'server-only';

import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
  type AccountBrandResolved,
} from '~/lib/brand/account-brand';

import { formatBookingWhenForEmail } from '../calendar-links';

export type BookingEmailContext = {
  workspaceName: string;
  accountSlug: string;
  brand: AccountBrandResolved;
  siteUrl: string;
  eventTypeName: string;
  pageTitle: string;
  inviteeName: string;
  inviteeEmail: string;
  inviteeTimezone: string;
  startAt: string;
  endAt: string;
  conferencingUrl: string | null;
  needsHostAttention: boolean;
  hostAttentionReason: string | null;
  managementToken: string;
  locationDetail: string | null;
  cancellationReason?: string | null;
  formResponses?: Array<{ label: string; value: string }>;
  inviteeNotes?: string | null;
  clientId?: string | null;
  previousStartAt?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function whenLine(ctx: BookingEmailContext, timeZone = ctx.inviteeTimezone) {
  return escapeHtml(formatBookingWhenForEmail(ctx.startAt, timeZone));
}

function joinBlock(ctx: BookingEmailContext) {
  if (ctx.conferencingUrl) {
    return `<p><strong>Join:</strong> <a href="${escapeHtml(ctx.conferencingUrl)}">${escapeHtml(ctx.conferencingUrl)}</a></p>`;
  }
  if (ctx.needsHostAttention) {
    return `<p><strong>Join link:</strong> A video link could not be created automatically. The host will send one separately — there is no join URL in this email.</p>`;
  }
  if (ctx.locationDetail) {
    return `<p><strong>Location:</strong> ${escapeHtml(ctx.locationDetail)}</p>`;
  }
  return '';
}

function manageBlock(ctx: BookingEmailContext) {
  const href = `${ctx.siteUrl.replace(/\/$/, '')}/book/manage/${ctx.managementToken}`;
  return `<p><a href="${escapeHtml(href)}">Manage your booking</a><br /><span style="color:#6B5B63;font-size:12px;">${escapeHtml(href)}</span></p>`;
}

function addToCalendarBlock(ctx: BookingEmailContext, googleUrl: string) {
  return `<p><strong>Add to calendar:</strong> an .ics file is attached. You can also <a href="${escapeHtml(googleUrl)}">add it in Google Calendar</a>.</p>`;
}

function formResponsesBlock(ctx: BookingEmailContext) {
  if (!ctx.formResponses?.length) return '';
  const items = ctx.formResponses
    .map(
      (row) =>
        `<li><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</li>`,
    )
    .join('');
  return `<p><strong>Form responses</strong></p><ul>${items}</ul>`;
}

function notesBlock(ctx: BookingEmailContext) {
  if (!ctx.inviteeNotes?.trim()) return '';
  const escaped = escapeHtml(ctx.inviteeNotes.trim()).replaceAll('\n', '<br />');
  return `<p><strong>Notes:</strong><br />${escaped}</p>`;
}

function clientLinkBlock(ctx: BookingEmailContext) {
  if (!ctx.clientId || !ctx.accountSlug) return '';
  const href = `${ctx.siteUrl.replace(/\/$/, '')}/app/${ctx.accountSlug}/clients/${ctx.clientId}`;
  return `<p><a href="${escapeHtml(href)}">View matched client</a></p>`;
}

function wrap(brand: AccountBrandResolved, inner: string) {
  return wrapEmailHtmlWithBrand({ brand, innerHtml: inner });
}

export async function loadBookingEmailBrand(accountId: string) {
  return loadAccountBrandResolved(accountId);
}

export function renderInviteeConfirmationEmail(
  ctx: BookingEmailContext,
  googleUrl: string,
) {
  const subject = `Confirmed: ${ctx.eventTypeName}`;
  const html = wrap(
    ctx.brand,
    `<p>Hi ${escapeHtml(ctx.inviteeName)},</p>
<p>Your booking with <strong>${escapeHtml(ctx.workspaceName)}</strong> is confirmed.</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>When:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}
${addToCalendarBlock(ctx, googleUrl)}
${manageBlock(ctx)}
<p style="color:#6B5B63;font-size:13px;">If anything changes, use the manage link above to reschedule or cancel.</p>`,
  );
  return { subject, html };
}

export function renderHostConfirmationEmail(ctx: BookingEmailContext) {
  const subject = ctx.needsHostAttention
    ? `New booking (needs attention): ${ctx.eventTypeName}`
    : `New booking: ${ctx.eventTypeName}`;
  const attention = ctx.needsHostAttention
    ? `<p><strong>Action needed:</strong> ${escapeHtml(ctx.hostAttentionReason ?? 'A video meeting link could not be created. Please share a join link with the invitee.')}</p>`
    : '';
  const html = wrap(
    ctx.brand,
    `<p>You have a new booking on <strong>${escapeHtml(ctx.pageTitle)}</strong>.</p>
<p><strong>Invitee:</strong> ${escapeHtml(ctx.inviteeName)} &lt;${escapeHtml(ctx.inviteeEmail)}&gt;</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>When:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}
${notesBlock(ctx)}
${formResponsesBlock(ctx)}
${clientLinkBlock(ctx)}
${attention}`,
  );
  return { subject, html };
}

export function renderGuestInvitationEmail(ctx: BookingEmailContext) {
  const subject = `You're invited: ${ctx.eventTypeName}`;
  const html = wrap(
    ctx.brand,
    `<p>Hello,</p>
<p>${escapeHtml(ctx.inviteeName)} invited you to a meeting with <strong>${escapeHtml(ctx.workspaceName)}</strong>.</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>When:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}
<p style="color:#6B5B63;font-size:13px;">This invitation does not include a manage link — contact ${escapeHtml(ctx.inviteeName)} if you need to change plans.</p>`,
  );
  return { subject, html };
}

export function renderInviteeReminderEmail(ctx: BookingEmailContext) {
  const subject = `Reminder: ${ctx.eventTypeName}`;
  const html = wrap(
    ctx.brand,
    `<p>Hi ${escapeHtml(ctx.inviteeName)},</p>
<p>This is a friendly reminder about your upcoming meeting with <strong>${escapeHtml(ctx.workspaceName)}</strong>.</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>When:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}
${manageBlock(ctx)}`,
  );
  return { subject, html };
}

export function renderHostReminderEmail(ctx: BookingEmailContext) {
  const subject = `Reminder: ${ctx.eventTypeName} with ${ctx.inviteeName}`;
  const html = wrap(
    ctx.brand,
    `<p>Reminder: you have an upcoming booking.</p>
<p><strong>Invitee:</strong> ${escapeHtml(ctx.inviteeName)} &lt;${escapeHtml(ctx.inviteeEmail)}&gt;</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>When:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}`,
  );
  return { subject, html };
}

export function renderInviteeCancellationEmail(ctx: BookingEmailContext) {
  const subject = `Cancelled: ${ctx.eventTypeName}`;
  const reason = ctx.cancellationReason
    ? `<p><strong>Reason:</strong> ${escapeHtml(ctx.cancellationReason)}</p>`
    : '';
  const html = wrap(
    ctx.brand,
    `<p>Hi ${escapeHtml(ctx.inviteeName)},</p>
<p>Your booking for <strong>${escapeHtml(ctx.eventTypeName)}</strong> with ${escapeHtml(ctx.workspaceName)} has been cancelled.</p>
<p><strong>Was scheduled for:</strong> ${whenLine(ctx)}</p>
${reason}`,
  );
  return { subject, html };
}

export function renderHostCancellationEmail(ctx: BookingEmailContext) {
  const subject = `Booking cancelled: ${ctx.eventTypeName}`;
  const reason = ctx.cancellationReason
    ? `<p><strong>Reason:</strong> ${escapeHtml(ctx.cancellationReason)}</p>`
    : '';
  const html = wrap(
    ctx.brand,
    `<p>The booking with ${escapeHtml(ctx.inviteeName)} has been cancelled.</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
<p><strong>Was scheduled for:</strong> ${whenLine(ctx)}</p>
${reason}`,
  );
  return { subject, html };
}

export function renderInviteeRescheduleEmail(ctx: BookingEmailContext) {
  const subject = `Rescheduled: ${ctx.eventTypeName}`;
  const previous = ctx.previousStartAt
    ? `<p><strong>Previously:</strong> ${escapeHtml(formatBookingWhenForEmail(ctx.previousStartAt, ctx.inviteeTimezone))}</p>`
    : '';
  const html = wrap(
    ctx.brand,
    `<p>Hi ${escapeHtml(ctx.inviteeName)},</p>
<p>Your booking with <strong>${escapeHtml(ctx.workspaceName)}</strong> has been moved.</p>
${previous}
<p><strong>New time:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}
${manageBlock(ctx)}`,
  );
  return { subject, html };
}

export function renderHostRescheduleEmail(ctx: BookingEmailContext) {
  const subject = `Booking rescheduled: ${ctx.eventTypeName}`;
  const previous = ctx.previousStartAt
    ? `<p><strong>Previously:</strong> ${escapeHtml(formatBookingWhenForEmail(ctx.previousStartAt, ctx.inviteeTimezone))}</p>`
    : '';
  const html = wrap(
    ctx.brand,
    `<p>${escapeHtml(ctx.inviteeName)} rescheduled their booking.</p>
<p><strong>Meeting:</strong> ${escapeHtml(ctx.eventTypeName)}</p>
${previous}
<p><strong>New time:</strong> ${whenLine(ctx)}</p>
${joinBlock(ctx)}`,
  );
  return { subject, html };
}
