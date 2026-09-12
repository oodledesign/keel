import { escapeEmailHtml } from '~/lib/email/ozer-transactional-shell';

export function buildProjectRetainerDigestBodyHtml(input: {
  projectTitle: string;
  balance: number;
  burned: number;
  restored: number;
  granted: number;
  debited?: number;
  weekStart: string;
}): string {
  const rows: Array<[string, string]> = [
    ['Credits used', String(input.burned)],
    ['Credits restored', String(input.restored)],
    ['Credits added', String(input.granted)],
    ['Credits removed', String(input.debited ?? 0)],
    ['Current balance', String(input.balance)],
  ];

  return `
    <p style="margin:0 0 16px;">Credit activity for <strong>${escapeEmailHtml(input.projectTitle)}</strong> in the week starting ${escapeEmailHtml(input.weekStart)} (Europe/London).</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;">
      ${rows
        .map(
          ([label, value]) => `
        <tr>
          <td style="padding:6px 0;color:#6b5b62;">${escapeEmailHtml(label)}</td>
          <td style="padding:6px 0;text-align:right;font-weight:600;">${escapeEmailHtml(value)}</td>
        </tr>`,
        )
        .join('')}
    </table>
  `;
}
