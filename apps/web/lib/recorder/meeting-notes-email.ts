import 'server-only';

import {
  loadAccountBrandResolved,
  wrapEmailHtmlWithBrand,
} from '~/lib/brand/account-brand';
import { buildPublicMeetingShareUrl } from '~/lib/recorder/public-meeting-share';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatMeetingDate(value: string | null) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export async function sendMeetingNotesEmails(params: {
  accountId: string;
  accountName?: string | null;
  meetingTitle: string;
  meetingDate: string | null;
  publicShareToken: string;
  recipientEmails: string[];
  summaryPreview?: string | null;
}): Promise<{ sent: number; failed: string[] }> {
  const sender = process.env.EMAIL_SENDER;
  if (!sender) {
    throw new Error('Email sender is not configured');
  }

  const emails = Array.from(
    new Set(
      params.recipientEmails
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    ),
  );

  if (emails.length === 0) {
    throw new Error('Add at least one valid email address');
  }

  const shareUrl = buildPublicMeetingShareUrl(params.publicShareToken);
  const brand = await loadAccountBrandResolved(params.accountId);
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Ozer';
  const fromName =
    params.accountName?.trim() || brand.contact_email || productName;
  const dateLabel = formatMeetingDate(params.meetingDate);
  const title = params.meetingTitle.trim() || 'Meeting notes';
  const subject = `Meeting notes: ${title}`;
  const preview = params.summaryPreview
    ?.replace(/[#*_`]/g, '')
    .trim()
    .slice(0, 280);

  const innerHtml = `
    <h2 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escapeHtml(title)}</h2>
    ${
      dateLabel
        ? `<p style="margin:0 0 16px;color:#64748b">${escapeHtml(dateLabel)}</p>`
        : ''
    }
    <p style="margin:0 0 16px">${escapeHtml(fromName)} shared meeting notes with you.</p>
    ${
      preview
        ? `<p style="margin:0 0 20px;padding:14px 16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;color:#334155;white-space:pre-wrap">${escapeHtml(preview)}${params.summaryPreview && params.summaryPreview.length > 280 ? '…' : ''}</p>`
        : ''
    }
    <p style="margin:0 0 24px">
      <a href="${escapeHtml(shareUrl)}" style="display:inline-block;padding:12px 18px;border-radius:10px;background:${escapeHtml(brand.accent_color)};color:#ffffff;text-decoration:none;font-weight:600">
        View meeting notes
      </a>
    </p>
    <p style="margin:0;font-size:12px;color:#94a3b8">
      Or open this link: <a href="${escapeHtml(shareUrl)}" style="color:#64748b">${escapeHtml(shareUrl)}</a>
    </p>
  `;

  const html = wrapEmailHtmlWithBrand({
    brand,
    innerHtml,
  });

  const failed: string[] = [];
  let sent = 0;

  for (const to of emails) {
    try {
      await sendPlatformEmail({
        type: 'meeting_notes',
        accountId: params.accountId,
        mail: {
          from: sender,
          to,
          subject,
          html,
        },
        metadata: {
          event: 'meeting_notes_shared',
          public_share_token: params.publicShareToken,
        },
      });
      sent += 1;
    } catch (error) {
      failed.push(to);
      console.error('[meeting-notes-email] send failed', {
        to,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (sent === 0) {
    throw new Error(
      failed.length > 0
        ? `Could not send to ${failed.join(', ')}`
        : 'Could not send meeting notes',
    );
  }

  return { sent, failed };
}
