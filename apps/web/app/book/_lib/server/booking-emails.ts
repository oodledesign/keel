import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { getTransactionalEmailSender } from '~/lib/email/zeptomail-client';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import {
  formatBookingWhenForEmail,
  googleCalendarTemplateUrl,
} from '../calendar-links';
import { bookingIcsAttachment } from './booking-ics-attachment';
import {
  loadBookingEmailBrand,
  renderGuestInvitationEmail,
  renderHostCancellationEmail,
  renderHostConfirmationEmail,
  renderHostReminderEmail,
  renderHostRescheduleEmail,
  renderInviteeCancellationEmail,
  renderInviteeConfirmationEmail,
  renderInviteeReminderEmail,
  renderInviteeRescheduleEmail,
  type BookingEmailContext,
} from './booking-email-templates';
import type { PublicBookingRecord } from './public-booking.service';

export type NotificationSettings = {
  sendConfirmationToInvitee: boolean;
  sendConfirmationToHost: boolean;
  sendCancellationEmails: boolean;
  replyToEmail: string | null;
};

export type BookingEmailGuest = {
  email: string;
  name?: string | null;
};

export type BookingEmailFormResponse = {
  label: string;
  value: string;
};

async function resolveHostEmail(hostUserId: string): Promise<string | null> {
  if (!hostUserId) return null;
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(hostUserId);
  if (error) return null;
  return data.user.email ?? null;
}

async function loadWorkspaceIdentity(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const [{ data: account }, brand] = await Promise.all([
    admin.from('accounts').select('name, slug').eq('id', accountId).maybeSingle(),
    loadBookingEmailBrand(accountId),
  ]);

  return {
    workspaceName: account?.name?.trim() || 'Ozer',
    accountSlug: account?.slug ?? '',
    brand,
  };
}

function siteUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://app.ozer.so'
  );
}

function buildContext(
  booking: PublicBookingRecord,
  identity: Awaited<ReturnType<typeof loadWorkspaceIdentity>>,
  extras?: {
    formResponses?: BookingEmailFormResponse[];
    cancellationReason?: string | null;
    previousStartAt?: string | null;
  },
): BookingEmailContext {
  return {
    workspaceName: identity.workspaceName,
    accountSlug: identity.accountSlug || booking.accountSlug || '',
    brand: identity.brand,
    siteUrl: siteUrl(),
    eventTypeName: booking.eventTypeName,
    pageTitle: booking.pageTitle,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    inviteeTimezone: booking.inviteeTimezone,
    startAt: booking.startAt,
    endAt: booking.endAt,
    conferencingUrl: booking.conferencingUrl,
    needsHostAttention: booking.needsHostAttention,
    hostAttentionReason: booking.hostAttentionReason,
    managementToken: booking.managementToken,
    locationDetail: booking.locationDetail,
    cancellationReason: extras?.cancellationReason ?? booking.cancellationReason,
    formResponses: extras?.formResponses,
    inviteeNotes: booking.inviteeNotes ?? null,
    clientId: booking.clientId,
    previousStartAt: extras?.previousStartAt ?? null,
  };
}

function icsFor(booking: PublicBookingRecord, workspaceName: string) {
  return bookingIcsAttachment({
    title: booking.eventTypeName,
    description: `Meeting with ${workspaceName}`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: booking.conferencingUrl ?? booking.locationDetail,
    url: booking.conferencingUrl,
    uid: `booking-${booking.id}@ozer.so`,
    attendeeEmail: booking.inviteeEmail,
    attendeeName: booking.inviteeName,
    organizerName: workspaceName,
  });
}

async function sendMail(input: {
  accountId: string;
  to: string;
  toName?: string;
  from: string;
  replyTo: string | null;
  subject: string;
  html: string;
  kind: string;
  bookingId: string;
  attachments?: Array<{ name: string; content: string; mimeType: string }>;
}) {
  await sendPlatformEmail({
    type: 'event',
    accountId: input.accountId,
    mail: {
      to: input.to,
      from: input.from,
      subject: input.subject,
      html: input.html,
      replyTo: input.replyTo ?? undefined,
      attachments: input.attachments,
    },
    metadata: { bookingId: input.bookingId, kind: input.kind },
  });
}

/**
 * Soft-fail: callers should catch. Email failure must not roll back bookings.
 */
export async function sendBookingConfirmationEmails(input: {
  booking: PublicBookingRecord;
  settings: NotificationSettings;
  hostUserId: string;
  guests?: BookingEmailGuest[];
  formResponses?: BookingEmailFormResponse[];
}) {
  const identity = await loadWorkspaceIdentity(input.booking.accountId);
  const from = getTransactionalEmailSender(identity.workspaceName);
  const replyTo = input.settings.replyToEmail;
  const ctx = buildContext(input.booking, identity, {
    formResponses: input.formResponses,
  });
  const ics = icsFor(input.booking, identity.workspaceName);
  const googleUrl = googleCalendarTemplateUrl({
    title: input.booking.eventTypeName,
    details: `Booked via ${input.booking.pageTitle}`,
    startAt: input.booking.startAt,
    endAt: input.booking.endAt,
    location: input.booking.conferencingUrl ?? input.booking.locationDetail,
  });

  const jobs: Array<Promise<void>> = [];

  if (input.settings.sendConfirmationToInvitee) {
    const rendered = renderInviteeConfirmationEmail(ctx, googleUrl);
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: input.booking.inviteeEmail,
        from,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        kind: 'booking_confirmation_invitee',
        bookingId: input.booking.id,
        attachments: [ics],
      }),
    );
  }

  if (input.settings.sendConfirmationToHost) {
    const hostEmail = await resolveHostEmail(input.hostUserId);
    if (hostEmail) {
      const rendered = renderHostConfirmationEmail(ctx);
      jobs.push(
        sendMail({
          accountId: input.booking.accountId,
          to: hostEmail,
          from,
          replyTo,
          subject: rendered.subject,
          html: rendered.html,
          kind: 'booking_confirmation_host',
          bookingId: input.booking.id,
        }),
      );
    }
  }

  for (const guest of input.guests ?? []) {
    const rendered = renderGuestInvitationEmail(ctx);
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: guest.email,
        from,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        kind: 'booking_guest_invitation',
        bookingId: input.booking.id,
        attachments: [ics],
      }),
    );
  }

  await Promise.allSettled(jobs);
}

export async function sendBookingCancellationEmails(input: {
  booking: PublicBookingRecord;
  settings: NotificationSettings;
  hostUserId: string;
  guests?: BookingEmailGuest[];
}) {
  if (!input.settings.sendCancellationEmails) return;

  const identity = await loadWorkspaceIdentity(input.booking.accountId);
  const from = getTransactionalEmailSender(identity.workspaceName);
  const replyTo = input.settings.replyToEmail;
  const ctx = buildContext(input.booking, identity, {
    cancellationReason: input.booking.cancellationReason,
  });

  const jobs: Array<Promise<void>> = [
    sendMail({
      accountId: input.booking.accountId,
      to: input.booking.inviteeEmail,
      from,
      replyTo,
      ...renderInviteeCancellationEmail(ctx),
      kind: 'booking_cancellation_invitee',
      bookingId: input.booking.id,
    }),
  ];

  const hostEmail = await resolveHostEmail(input.hostUserId);
  if (hostEmail) {
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: hostEmail,
        from,
        replyTo,
        ...renderHostCancellationEmail(ctx),
        kind: 'booking_cancellation_host',
        bookingId: input.booking.id,
      }),
    );
  }

  for (const guest of input.guests ?? []) {
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: guest.email,
        from,
        replyTo,
        subject: `Cancelled: ${input.booking.eventTypeName}`,
        html: renderInviteeCancellationEmail({
          ...ctx,
          inviteeName: guest.name?.trim() || 'there',
        }).html,
        kind: 'booking_cancellation_guest',
        bookingId: input.booking.id,
      }),
    );
  }

  await Promise.allSettled(jobs);
}

export async function sendBookingRescheduleEmails(input: {
  previous: PublicBookingRecord;
  booking: PublicBookingRecord;
  settings: NotificationSettings;
  hostUserId: string;
  guests?: BookingEmailGuest[];
}) {
  const identity = await loadWorkspaceIdentity(input.booking.accountId);
  const from = getTransactionalEmailSender(identity.workspaceName);
  const replyTo = input.settings.replyToEmail;
  const ctx = buildContext(input.booking, identity, {
    previousStartAt: input.previous.startAt,
  });
  const ics = icsFor(input.booking, identity.workspaceName);

  const jobs: Array<Promise<void>> = [];

  if (input.settings.sendConfirmationToInvitee) {
    const rendered = renderInviteeRescheduleEmail(ctx);
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: input.booking.inviteeEmail,
        from,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        kind: 'booking_reschedule_invitee',
        bookingId: input.booking.id,
        attachments: [ics],
      }),
    );
  }

  if (input.settings.sendConfirmationToHost) {
    const hostEmail = await resolveHostEmail(input.hostUserId);
    if (hostEmail) {
      const rendered = renderHostRescheduleEmail(ctx);
      jobs.push(
        sendMail({
          accountId: input.booking.accountId,
          to: hostEmail,
          from,
          replyTo,
          subject: rendered.subject,
          html: rendered.html,
          kind: 'booking_reschedule_host',
          bookingId: input.booking.id,
        }),
      );
    }
  }

  for (const guest of input.guests ?? []) {
    const rendered = renderInviteeRescheduleEmail({
      ...ctx,
      inviteeName: guest.name?.trim() || 'there',
    });
    jobs.push(
      sendMail({
        accountId: input.booking.accountId,
        to: guest.email,
        from,
        replyTo,
        subject: rendered.subject,
        html: rendered.html,
        kind: 'booking_reschedule_guest',
        bookingId: input.booking.id,
        attachments: [ics],
      }),
    );
  }

  await Promise.allSettled(jobs);
}

export async function sendBookingReminderEmail(input: {
  booking: PublicBookingRecord;
  recipient: 'invitee' | 'host';
  hostUserId: string;
  settings: NotificationSettings;
}) {
  const identity = await loadWorkspaceIdentity(input.booking.accountId);
  const from = getTransactionalEmailSender(identity.workspaceName);
  const replyTo = input.settings.replyToEmail;
  const ctx = buildContext(input.booking, identity);

  if (input.recipient === 'invitee') {
    const rendered = renderInviteeReminderEmail(ctx);
    await sendMail({
      accountId: input.booking.accountId,
      to: input.booking.inviteeEmail,
      from,
      replyTo,
      subject: rendered.subject,
      html: rendered.html,
      kind: 'booking_reminder_invitee',
      bookingId: input.booking.id,
      attachments: [icsFor(input.booking, identity.workspaceName)],
    });
    return;
  }

  const hostEmail = await resolveHostEmail(input.hostUserId);
  if (!hostEmail) {
    throw new Error('Host email not found for reminder');
  }

  const rendered = renderHostReminderEmail(ctx);
  await sendMail({
    accountId: input.booking.accountId,
    to: hostEmail,
    from,
    replyTo,
    subject: rendered.subject,
    html: rendered.html,
    kind: 'booking_reminder_host',
    bookingId: input.booking.id,
  });
}

/** Exported for tests / debugging */
export { formatBookingWhenForEmail };
