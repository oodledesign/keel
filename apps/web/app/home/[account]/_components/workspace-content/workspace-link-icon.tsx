'use client';

import { useState } from 'react';

import { Link2 } from 'lucide-react';

import { cn } from '@kit/ui/utils';

import { displayLinkIconUrl } from '~/lib/workspace-links/link-icon';

export function WorkspaceLinkIcon({
  url,
  faviconUrl,
  title,
  className,
}: {
  url: string;
  faviconUrl: string | null;
  title: string;
  className?: string;
}) {
  const src = displayLinkIconUrl(url, faviconUrl);
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
          className,
        )}
      >
        <Link2 className="h-4 w-4" />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      title={title}
      onError={() => setFailed(true)}
      className={cn(
        'h-9 w-9 shrink-0 rounded-lg bg-[var(--workspace-shell-sidebar-accent)] object-contain p-1.5',
        className,
      )}
    />
  );
}
