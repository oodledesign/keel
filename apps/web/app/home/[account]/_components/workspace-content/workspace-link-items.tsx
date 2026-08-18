'use client';

import { ExternalLink, Trash2 } from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import { displayLinkHostname } from '~/lib/workspace-links/link-metadata';
import {
  workspaceCardHover,
  workspaceSuccessBadgeBorder,
} from '~/lib/workspace-ui';

import type { SavedLinkListItem } from '../../_lib/workspace-content/types';
import { WorkspaceLinkIcon } from './workspace-link-icon';

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export function WorkspaceLinkRow({
  link,
  canEdit,
  pending,
  onDelete,
  className,
}: {
  link: SavedLinkListItem;
  canEdit?: boolean;
  pending?: boolean;
  onDelete?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-stretch gap-1 bg-[var(--workspace-shell-panel)] transition hover:bg-[var(--workspace-shell-sidebar-accent)]',
        className,
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left"
      >
        <WorkspaceLinkIcon
          url={link.url}
          faviconUrl={link.faviconUrl}
          title={link.title}
          className="mt-0.5 h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-[var(--workspace-shell-sidebar-accent)] text-[10px] text-[var(--workspace-shell-text-muted)]">
              Link
            </Badge>
            <span className="truncate font-medium text-[var(--workspace-shell-text)]">
              {link.title}
            </span>
            <ExternalLink className="h-3.5 w-3.5 shrink-0 text-[var(--workspace-shell-text-muted)]" />
          </div>
          <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
            {displayLinkHostname(link.url)}
            {link.description ? ` · ${link.description}` : ''}
            {` · ${formatDate(link.updatedAt)}`}
          </p>
          {link.context ? (
            <Badge
              variant="outline"
              className={cn('mt-1 text-xs', workspaceSuccessBadgeBorder)}
            >
              {link.context.label}
            </Badge>
          ) : null}
        </div>
      </a>
      {canEdit && onDelete ? (
        <div className="flex items-center pr-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={pending}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onDelete();
            }}
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function WorkspaceLinkCard({
  link,
  canEdit,
  pending,
  onDelete,
}: {
  link: SavedLinkListItem;
  canEdit?: boolean;
  pending?: boolean;
  onDelete?: () => void;
}) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] transition hover:border-[var(--ozer-accent)]/30',
        workspaceCardHover,
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-left"
      >
        {link.ogImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Open Graph images
          <img
            src={link.ogImageUrl}
            alt=""
            className="h-28 w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
        <div className="p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <WorkspaceLinkIcon
              url={link.url}
              faviconUrl={link.faviconUrl}
              title={link.title}
            />
            <ExternalLink className="h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
          </div>
          <p className="line-clamp-2 font-medium text-[var(--workspace-shell-text)]">
            {link.title}
          </p>
          <p className="mt-1 truncate text-xs text-[var(--workspace-shell-text-muted)]">
            {displayLinkHostname(link.url)}
          </p>
          {link.description ? (
            <p className="mt-2 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">
              {link.description}
            </p>
          ) : null}
        </div>
      </a>
      {canEdit && onDelete ? (
        <div className="px-4 pb-4">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 text-[var(--workspace-shell-text-muted)] hover:text-red-400"
            disabled={pending}
            onClick={onDelete}
          >
            Delete
          </Button>
        </div>
      ) : null}
    </div>
  );
}
