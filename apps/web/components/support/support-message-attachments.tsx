'use client';

import { cn } from '@kit/ui/utils';

import type { SupportAttachmentMeta } from '~/lib/support/support-attachment.types';

function isImageAttachment(file: SupportAttachmentMeta) {
  if (file.mimeType?.startsWith('image/')) return true;
  return /\.(png|jpe?g|gif|webp|avif)$/i.test(file.name || file.url);
}

export function SupportMessageAttachments({
  attachments,
  className,
}: {
  attachments?: SupportAttachmentMeta[] | null;
  className?: string;
}) {
  if (!attachments?.length) return null;

  const images = attachments.filter(isImageAttachment);
  const files = attachments.filter((file) => !isImageAttachment(file));

  return (
    <div className={cn('mt-3 space-y-3', className)}>
      {images.length > 0 ? (
        <div className="flex flex-col gap-2">
          {images.map((file) => (
            <a
              key={file.url}
              href={file.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote support uploads */}
              <img
                src={file.url}
                alt={file.name}
                className="max-h-80 w-full object-contain"
              />
            </a>
          ))}
        </div>
      ) : null}

      {files.length > 0 ? (
        <ul className="space-y-1">
          {files.map((file) => (
            <li key={file.url}>
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[var(--ozer-accent-muted)] hover:underline"
              >
                {file.name}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
