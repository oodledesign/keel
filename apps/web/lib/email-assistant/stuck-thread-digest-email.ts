import 'server-only';

import { escapeEmailHtml } from '~/lib/email/ozer-transactional-shell';

export type StuckThreadDigestItem = {
  id: string;
  subject: string | null;
  lastMessageAt: string | null;
  clientName: string | null;
  href: string;
  ageDays: number;
};

export function buildStuckThreadDigestBodyHtml(input: {
  threads: StuckThreadDigestItem[];
  reviewHref: string;
}): string {
  const rows = input.threads
    .map((thread) => {
      const subject = escapeEmailHtml(thread.subject?.trim() || '(no subject)');
      const client = thread.clientName
        ? escapeEmailHtml(thread.clientName)
        : 'Unlinked';
      const age = `${thread.ageDays} day${thread.ageDays === 1 ? '' : 's'}`;

      return `<tr>
        <td style="padding:10px 0;border-bottom:1px solid #efe6ea;">
          <a href="${escapeEmailHtml(thread.href)}" style="color:#41606F;font-weight:600;text-decoration:none;">${subject}</a>
          <div style="margin-top:4px;font-size:13px;color:#6B5560;">${client} · ${age}</div>
        </td>
      </tr>`;
    })
    .join('');

  return `
    <p style="margin:0 0 16px;font-size:15px;color:#2A1720;">
      These threads have been waiting for a reply for a few days.
    </p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${rows}
    </table>
    <p style="margin:20px 0 0;">
      <a href="${escapeEmailHtml(input.reviewHref)}" style="display:inline-block;background:#FF5C34;color:#fff;text-decoration:none;font-weight:600;padding:10px 16px;border-radius:10px;">
        Review inbox
      </a>
    </p>
  `;
}
