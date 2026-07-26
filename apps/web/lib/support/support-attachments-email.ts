import { escapeEmailHtml } from '~/lib/email/ozer-transactional-shell';
import type { SupportAttachmentMeta } from '~/lib/support/support-attachment.types';

function isImageAttachment(file: SupportAttachmentMeta) {
  if (file.mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name || file.url);
}

/**
 * Inline images + download links for support notification emails.
 * Attachment URLs must be publicly reachable for email clients.
 */
export function renderSupportAttachmentsEmailHtml(
  attachments?: SupportAttachmentMeta[] | null,
): string {
  if (!attachments?.length) return '';

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((file) => !isImageAttachment(file));

  const imageBlock =
    images.length > 0
      ? `<div style="margin:16px 0 0;">
          ${images
            .map(
              (file) =>
                `<div style="margin:0 0 12px;">
                  <a href="${escapeEmailHtml(file.url)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;">
                    <img src="${escapeEmailHtml(file.url)}" alt="${escapeEmailHtml(file.name)}" width="480" style="display:block;max-width:100%;width:100%;height:auto;border:0;border-radius:12px;" />
                  </a>
                  <p style="margin:6px 0 0;font-size:12px;line-height:1.4;color:#9B8590;">
                    <a href="${escapeEmailHtml(file.url)}" style="color:#FF5C34;text-decoration:none;">${escapeEmailHtml(file.name)}</a>
                  </p>
                </div>`,
            )
            .join('')}
        </div>`
      : '';

  const fileBlock =
    files.length > 0
      ? `<p style="margin:16px 0 0;"><strong>Attachments:</strong></p>
        <ul style="margin:8px 0 0;padding-left:18px;">
          ${files
            .map(
              (file) =>
                `<li style="margin:0 0 6px;"><a href="${escapeEmailHtml(file.url)}" style="color:#FF5C34;text-decoration:none;">${escapeEmailHtml(file.name)}</a></li>`,
            )
            .join('')}
        </ul>`
      : '';

  return `${imageBlock}${fileBlock}`;
}
