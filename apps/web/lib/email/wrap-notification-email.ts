import {
  escapeEmailHtml,
  renderOzerTransactionalEmail,
} from '~/lib/email/ozer-transactional-shell';

export { escapeEmailHtml as escapeNotificationHtml };

export type WrapNotificationEmailOptions = {
  /** Visible heading in the card (and default document title). */
  heading?: string;
  /** Document title / subject-adjacent label. */
  title?: string;
  /** Inbox preheader. */
  preview?: string;
  cta?: { label: string; href: string };
  footerNote?: string;
  productName?: string;
};

/**
 * Shared transactional email shell used by trial reminders, platform support,
 * workspace client-support notifications, and scheduling booking emails.
 *
 * Renders the branded Ozer HTML template (plum header, cream canvas, coral CTA).
 */
export function wrapNotificationEmail(
  bodyHtml: string,
  options: WrapNotificationEmailOptions = {},
) {
  const heading = options.heading?.trim() || options.title?.trim() || 'Update';
  const title = options.title?.trim() || heading;

  return renderOzerTransactionalEmail({
    title,
    preview: options.preview,
    heading,
    bodyHtml,
    cta: options.cta,
    footerNote: options.footerNote,
    productName: options.productName,
  });
}
