'use client';

import { cn } from '@kit/ui/utils';

import type { EmailGmailLabel } from '../_lib/types';

const HIDDEN_CHIP_IDS = new Set([
  'INBOX',
  'UNREAD',
  'STARRED',
  'IMPORTANT',
  'SENT',
  'DRAFT',
  'SPAM',
  'TRASH',
  'CATEGORY_PERSONAL',
  'CATEGORY_SOCIAL',
  'CATEGORY_PROMOTIONS',
  'CATEGORY_UPDATES',
  'CATEGORY_FORUMS',
]);

export function resolveEmailLabelName(
  labelId: string,
  labels: EmailGmailLabel[],
): string {
  return labels.find((label) => label.id === labelId)?.name ?? labelId;
}

export function visibleThreadLabelIds(
  labelIds: string[] | null | undefined,
  labels: EmailGmailLabel[],
): string[] {
  const byId = new Map(labels.map((label) => [label.id, label]));

  return (labelIds ?? []).filter((id) => {
    if (HIDDEN_CHIP_IDS.has(id) || id.startsWith('CATEGORY_')) {
      return false;
    }

    const meta = byId.get(id);
    if (meta?.type === 'system') {
      return false;
    }

    return true;
  });
}

type EmailLabelChipsProps = {
  labelIds: string[] | null | undefined;
  labels: EmailGmailLabel[];
  className?: string;
  max?: number;
  onLabelClick?: (labelId: string) => void;
};

export function EmailLabelChips({
  labelIds,
  labels,
  className,
  max = 4,
  onLabelClick,
}: EmailLabelChipsProps) {
  const visible = visibleThreadLabelIds(labelIds, labels);
  if (visible.length === 0) {
    return null;
  }

  const shown = visible.slice(0, max);
  const overflow = visible.length - shown.length;

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {shown.map((id) => {
        const name = resolveEmailLabelName(id, labels);
        const isOzer = name.startsWith('Ozer/');

        return (
          <button
            key={id}
            type="button"
            disabled={!onLabelClick}
            onClick={(event) => {
              event.stopPropagation();
              onLabelClick?.(id);
            }}
            className={cn(
              'max-w-[9rem] truncate rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-none',
              isOzer
                ? 'border-[color:var(--ozer-accent)]/30 bg-[color:var(--ozer-accent)]/10 text-[color:var(--ozer-accent)]'
                : 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
              onLabelClick && 'hover:opacity-80',
              !onLabelClick && 'cursor-default',
            )}
            title={name}
          >
            {name.replace(/^Ozer\//, '')}
          </button>
        );
      })}
      {overflow > 0 ? (
        <span className="text-[10px] text-[color:var(--workspace-shell-text-muted)]">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}
