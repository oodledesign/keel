import 'server-only';

import type { AccountBrandResolved } from '~/lib/brand/account-brand';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import {
  escapeNotificationHtml,
  wrapNotificationEmail,
} from '~/lib/email/wrap-notification-email';
import { OZER_EMAIL_BRAND } from '~/lib/email/ozer-transactional-shell';

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

const LINK = OZER_EMAIL_BRAND.accent;
const MUTED = OZER_EMAIL_BRAND.muted;

function escapeHtml(value: string) {
  return escapeNotificationHtml(value);
}

function siteBase(ctx: BookingEmailContext) {
  return ctx.siteUrl.replace(/\/$/, '');
}

function manageHref(ctx: BookingEmailContext) {
  return `${siteBase(ctx)}/book/manage/${ctx.managementToken}`;
}

function hostBookingsHref(ctx: BookingEmailContext) {
  if (!ctx.accountSlug) return null;
  return `${siteBase(ctx)}/app/${ctx.accountSlug}/scheduling/bookings`;
}

function clientHref(ctx: BookingEmailContext) {
  if (!ctx.clientId || !ctx.accountSlug) return null;
  return `${siteBase(ctx)}/app/${ctx.accountSlug}/clients/${ctx.clientId}`;
}

function whenLine(ctx: BookingEmailContext, timeZone = ctx.inviteeTimezone) {
  return escapeHtml(formatBookingWhenForEmail(ctx.startAt, timeZone));
}

function detailRow(label: string, valueHtml: string) {
  return `<p style="margin:0 0 8px;"><strong>${escapeHtml(label)}:</strong> ${valueHtml}</p>`;
}

function paragraph(html: string, bottom = 12) {
  return `<p style="margin:0 0 ${bottom}px;">${html}</p>`;
}

function mutedNote(html: string) {
  return `<p style="margin:12px 0 0;font-size:13px;color:${MUTED};">${html}</p>`;
}

function textLink(label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="color:${LINK};text-decoration:underline;">${escapeHtml(label)}</a>`;
}

function joinBlock(ctx: BookingEmailContext) {
  if (ctx.conferencingUrl) {
    return detailRow(
      'Join',
      textLink(ctx.conferencingUrl, ctx.conferencingUrl),
    );
  }
  if (ctx.needsHostAttention) {
    return paragraph(
      '<strong>Join link:</strong> A video link could not be created automatically. The host will send one separately — there is no join URL in this email.',
    );
  }
  if (ctx.locationDetail) {
    return detailRow('Location', escapeHtml(ctx.locationDetail));
  }
  return '';
}

function manageLinkBlock(ctx: BookingEmailContext) {
  const href = manageHref(ctx);
  return mutedNote(
    `${textLink('Open manage link', href)}<br /><span style="word-break:break-all;font-size:12px;">${escapeHtml(href)}</span>`,
  );
}

function addToCalendarBlock(googleUrl: string) {
  return paragraph(
    `<strong>Add to calendar:</strong> an .ics file is attached. You can also ${textLink('add it in Google Calendar', googleUrl)}.`,
  );
}

function formResponsesBlock(ctx: BookingEmailContext) {
  if (!ctx.formResponses?.length) return '';
  const items = ctx.formResponses
    .map(
      (row) =>
        `<li style="margin:0 0 4px;"><strong>${escapeHtml(row.label)}:</strong> ${escapeHtml(row.value)}</li>`,
    )
    .join('');
  return `${paragraph('<strong>Form responses</strong>', 8)}<ul style="margin:0 0 12px;padding-left:18px;">${items}</ul>`;
}

function notesBlock(ctx: BookingEmailContext) {
  if (!ctx.inviteeNotes?.trim()) return '';
  const escaped = escapeHtml(ctx.inviteeNotes.trim()).replaceAll(
    '\n',
    '<br />',
  );
  return paragraph(`<strong>Notes:</strong><br />${escaped}`);
}

function clientLinkBlock(ctx: BookingEmailContext) {
  const href = clientHref(ctx);
  if (!href) return '';
  return paragraph(textLink('View matched client', href));
}

function wrapBookingEmail(
  bodyHtml: string,
  options: {
    heading: string;
    title?: string;
    preview: string;
    cta?: { label: string; href: string };
    footerNote: string;
  },
) {
  return wrapNotificationEmail(bodyHtml, {
    productName: 'Ozer',
    title: options.title ?? options.heading,
    heading: options.heading,
    preview: options.preview,
    cta: options.cta,
    footerNote: options.footerNote,
  });
}

export async function loadBookingEmailBrand(accountId: string) {
  return loadAccountBrandResolved(accountId);
}

export function renderInviteeConfirmationEmail(
  ctx: BookingEmailContext,
  googleUrl: string,
) {
  const subject = `Confirmed: ${ctx.eventTypeName}`;
  const html = wrapBookingEmail(
    `${paragraph(`Hi ${escapeHtml(ctx.inviteeName)},`)}
${paragraph(`Your booking with <strong>${escapeHtml(ctx.workspaceName)}</strong> is confirmed.`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('When', whenLine(ctx))}
${joinBlock(ctx)}
${addToCalendarBlock(googleUrl)}
${mutedNote('If anything changes, use the button below to reschedule or cancel.')}
${manageLinkBlock(ctx)}`,
    {
      heading: 'Booking confirmed',
      preview: `${ctx.eventTypeName} with ${ctx.workspaceName} — ${formatBookingWhenForEmail(ctx.startAt, ctx.inviteeTimezone)}`,
      cta: { label: 'Manage your booking', href: manageHref(ctx) },
      footerNote: `You're receiving this because you booked with ${escapeHtml(ctx.workspaceName)} on Ozer.`,
    },
  );
  return { subject, html };
}

export function renderHostConfirmationEmail(ctx: BookingEmailContext) {
  const subject = ctx.needsHostAttention
    ? `New booking (needs attention): ${ctx.eventTypeName}`
    : `New booking: ${ctx.eventTypeName}`;
  const attention = ctx.needsHostAttention
    ? paragraph(
        `<strong>Action needed:</strong> ${escapeHtml(ctx.hostAttentionReason ?? 'A video meeting link could not be created. Please share a join link with the invitee.')}`,
      )
    : '';
  const bookingsHref = hostBookingsHref(ctx);
  const html = wrapBookingEmail(
    `${paragraph(`You have a new booking on <strong>${escapeHtml(ctx.pageTitle)}</strong>.`)}
${detailRow('Invitee', `${escapeHtml(ctx.inviteeName)} &lt;${escapeHtml(ctx.inviteeEmail)}&gt;`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('When', whenLine(ctx))}
${joinBlock(ctx)}
${notesBlock(ctx)}
${formResponsesBlock(ctx)}
${clientLinkBlock(ctx)}
${attention}`,
    {
      heading: ctx.needsHostAttention
        ? 'New booking needs attention'
        : 'New booking',
      preview: `${ctx.inviteeName} booked ${ctx.eventTypeName}`,
      cta: bookingsHref
        ? { label: 'View bookings', href: bookingsHref }
        : undefined,
      footerNote: `You're receiving this because a booking was made on your ${escapeHtml(ctx.workspaceName)} scheduling page.`,
    },
  );
  return { subject, html };
}

export function renderGuestInvitationEmail(ctx: BookingEmailContext) {
  const subject = `You're invited: ${ctx.eventTypeName}`;
  const html = wrapBookingEmail(
    `${paragraph('Hello,')}
${paragraph(`${escapeHtml(ctx.inviteeName)} invited you to a meeting with <strong>${escapeHtml(ctx.workspaceName)}</strong>.`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('When', whenLine(ctx))}
${joinBlock(ctx)}
${mutedNote(`This invitation does not include a manage link — contact ${escapeHtml(ctx.inviteeName)} if you need to change plans.`)}`,
    {
      heading: "You're invited",
      preview: `${ctx.eventTypeName} with ${ctx.workspaceName}`,
      cta: ctx.conferencingUrl
        ? { label: 'Join meeting', href: ctx.conferencingUrl }
        : undefined,
      footerNote: `You're receiving this because ${escapeHtml(ctx.inviteeName)} added you as a guest.`,
    },
  );
  return { subject, html };
}

export function renderInviteeReminderEmail(ctx: BookingEmailContext) {
  const subject = `Reminder: ${ctx.eventTypeName}`;
  const html = wrapBookingEmail(
    `${paragraph(`Hi ${escapeHtml(ctx.inviteeName)},`)}
${paragraph(`This is a friendly reminder about your upcoming meeting with <strong>${escapeHtml(ctx.workspaceName)}</strong>.`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('When', whenLine(ctx))}
${joinBlock(ctx)}
${manageLinkBlock(ctx)}`,
    {
      heading: 'Meeting reminder',
      preview: `${ctx.eventTypeName} — ${formatBookingWhenForEmail(ctx.startAt, ctx.inviteeTimezone)}`,
      cta: ctx.conferencingUrl
        ? { label: 'Join meeting', href: ctx.conferencingUrl }
        : { label: 'Manage your booking', href: manageHref(ctx) },
      footerNote: `You're receiving this reminder for your booking with ${escapeHtml(ctx.workspaceName)}.`,
    },
  );
  return { subject, html };
}

export function renderHostReminderEmail(ctx: BookingEmailContext) {
  const subject = `Reminder: ${ctx.eventTypeName} with ${ctx.inviteeName}`;
  const bookingsHref = hostBookingsHref(ctx);
  const html = wrapBookingEmail(
    `${paragraph('Reminder: you have an upcoming booking.')}
${detailRow('Invitee', `${escapeHtml(ctx.inviteeName)} &lt;${escapeHtml(ctx.inviteeEmail)}&gt;`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('When', whenLine(ctx))}
${joinBlock(ctx)}`,
    {
      heading: 'Upcoming booking',
      preview: `${ctx.eventTypeName} with ${ctx.inviteeName}`,
      cta: ctx.conferencingUrl
        ? { label: 'Join meeting', href: ctx.conferencingUrl }
        : bookingsHref
          ? { label: 'View bookings', href: bookingsHref }
          : undefined,
      footerNote: `You're receiving this because you host bookings for ${escapeHtml(ctx.workspaceName)}.`,
    },
  );
  return { subject, html };
}

export function renderInviteeCancellationEmail(ctx: BookingEmailContext) {
  const subject = `Cancelled: ${ctx.eventTypeName}`;
  const reason = ctx.cancellationReason
    ? detailRow('Reason', escapeHtml(ctx.cancellationReason))
    : '';
  const html = wrapBookingEmail(
    `${paragraph(`Hi ${escapeHtml(ctx.inviteeName)},`)}
${paragraph(`Your booking for <strong>${escapeHtml(ctx.eventTypeName)}</strong> with ${escapeHtml(ctx.workspaceName)} has been cancelled.`)}
${detailRow('Was scheduled for', whenLine(ctx))}
${reason}`,
    {
      heading: 'Booking cancelled',
      preview: `${ctx.eventTypeName} was cancelled`,
      footerNote: `You're receiving this because you had a booking with ${escapeHtml(ctx.workspaceName)}.`,
    },
  );
  return { subject, html };
}

export function renderHostCancellationEmail(ctx: BookingEmailContext) {
  const subject = `Booking cancelled: ${ctx.eventTypeName}`;
  const reason = ctx.cancellationReason
    ? detailRow('Reason', escapeHtml(ctx.cancellationReason))
    : '';
  const bookingsHref = hostBookingsHref(ctx);
  const html = wrapBookingEmail(
    `${paragraph(`The booking with ${escapeHtml(ctx.inviteeName)} has been cancelled.`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${detailRow('Was scheduled for', whenLine(ctx))}
${reason}`,
    {
      heading: 'Booking cancelled',
      preview: `${ctx.inviteeName} — ${ctx.eventTypeName} cancelled`,
      cta: bookingsHref
        ? { label: 'View bookings', href: bookingsHref }
        : undefined,
      footerNote: `You're receiving this because a booking on ${escapeHtml(ctx.workspaceName)} was cancelled.`,
    },
  );
  return { subject, html };
}

export function renderInviteeRescheduleEmail(ctx: BookingEmailContext) {
  const subject = `Rescheduled: ${ctx.eventTypeName}`;
  const previous = ctx.previousStartAt
    ? detailRow(
        'Previously',
        escapeHtml(
          formatBookingWhenForEmail(ctx.previousStartAt, ctx.inviteeTimezone),
        ),
      )
    : '';
  const html = wrapBookingEmail(
    `${paragraph(`Hi ${escapeHtml(ctx.inviteeName)},`)}
${paragraph(`Your booking with <strong>${escapeHtml(ctx.workspaceName)}</strong> has been moved.`)}
${previous}
${detailRow('New time', whenLine(ctx))}
${joinBlock(ctx)}
${manageLinkBlock(ctx)}`,
    {
      heading: 'Booking rescheduled',
      preview: `${ctx.eventTypeName} moved to ${formatBookingWhenForEmail(ctx.startAt, ctx.inviteeTimezone)}`,
      cta: { label: 'Manage your booking', href: manageHref(ctx) },
      footerNote: `You're receiving this because your booking with ${escapeHtml(ctx.workspaceName)} changed.`,
    },
  );
  return { subject, html };
}

export function renderHostRescheduleEmail(ctx: BookingEmailContext) {
  const subject = `Booking rescheduled: ${ctx.eventTypeName}`;
  const previous = ctx.previousStartAt
    ? detailRow(
        'Previously',
        escapeHtml(
          formatBookingWhenForEmail(ctx.previousStartAt, ctx.inviteeTimezone),
        ),
      )
    : '';
  const bookingsHref = hostBookingsHref(ctx);
  const html = wrapBookingEmail(
    `${paragraph(`${escapeHtml(ctx.inviteeName)} rescheduled their booking.`)}
${detailRow('Meeting', escapeHtml(ctx.eventTypeName))}
${previous}
${detailRow('New time', whenLine(ctx))}
${joinBlock(ctx)}`,
    {
      heading: 'Booking rescheduled',
      preview: `${ctx.inviteeName} moved ${ctx.eventTypeName}`,
      cta: bookingsHref
        ? { label: 'View bookings', href: bookingsHref }
        : undefined,
      footerNote: `You're receiving this because a booking on ${escapeHtml(ctx.workspaceName)} was rescheduled.`,
    },
  );
  return { subject, html };
}
