import 'server-only';

import pathsConfig from '~/config/paths.config';
import { createInAppNotification } from '~/lib/notifications/create-in-app-notification';

function formatTicketNumber(ticketNumber: number) {
  return `#${ticketNumber}`;
}

function agencyTicketLink(accountSlug: string, ticketId: string) {
  return pathsConfig.app.accountSupportDetail
    .replace('[account]', accountSlug)
    .replace('[id]', ticketId);
}

function partnerTicketLink(accountSlug: string, ticketId: string) {
  return pathsConfig.app.accountPartnerSupportDetail
    .replace('[account]', accountSlug)
    .replace('[id]', ticketId);
}

export async function notifySupportNewTicketInApp(params: {
  accountId: string;
  accountSlug: string;
  ticketId: string;
  ticketNumber: number;
  title: string;
  submitterLabel: string;
}) {
  const label = formatTicketNumber(params.ticketNumber);
  await createInAppNotification({
    accountId: params.accountId,
    body: `New support ticket ${label}: ${params.title} (from ${params.submitterLabel})`,
    link: agencyTicketLink(params.accountSlug, params.ticketId),
  });
}

export async function notifySupportClientReplyInApp(params: {
  accountId: string;
  accountSlug: string;
  ticketId: string;
  ticketNumber: number;
  title: string;
  authorName: string;
}) {
  const label = formatTicketNumber(params.ticketNumber);
  await createInAppNotification({
    accountId: params.accountId,
    body: `${params.authorName} replied on support ${label}: ${params.title}`,
    link: agencyTicketLink(params.accountSlug, params.ticketId),
  });
}

export async function notifySupportAgencyReplyInApp(params: {
  accountId: string;
  accountSlug: string;
  ticketId: string;
  ticketNumber: number;
  title: string;
  /** When true, link to partner-support (guest workspace). */
  partnerView?: boolean;
}) {
  const label = formatTicketNumber(params.ticketNumber);
  const link = params.partnerView
    ? partnerTicketLink(params.accountSlug, params.ticketId)
    : agencyTicketLink(params.accountSlug, params.ticketId);

  await createInAppNotification({
    accountId: params.accountId,
    body: `New reply on support ${label}: ${params.title}`,
    link,
  });
}
