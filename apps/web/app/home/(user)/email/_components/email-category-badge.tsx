'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  EMAIL_THREAD_CATEGORY_LABELS,
  type EmailThreadCategory,
} from '~/lib/email-assistant/email-thread-categories';

const CATEGORY_STYLES: Record<
  EmailThreadCategory,
  { border: string; bg: string; text: string }
> = {
  reply_now: {
    border: 'border-[var(--ozer-accent)]/30',
    bg: 'bg-[var(--ozer-accent-subtle)]',
    text: 'text-[var(--ozer-accent)]',
  },
  reply_later: {
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
  },
  waiting: {
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
  },
  fyi: {
    border: 'border-[color:var(--workspace-shell-border)]',
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]',
    text: 'text-[var(--workspace-shell-text-muted)]',
  },
  noise: {
    border: 'border-[color:var(--workspace-shell-border)]',
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]/60',
    text: 'text-[var(--workspace-shell-text-muted)]',
  },
};

type Props = {
  category: EmailThreadCategory | null;
  reason?: string | null;
  confidence?: number | null;
  className?: string;
  showWhy?: boolean;
};

export function EmailCategoryBadge({
  category,
  reason,
  confidence,
  className,
  showWhy = false,
}: Props) {
  if (!category) {
    return (
      <span
        className={cn(
          'inline-flex rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase',
          className,
        )}
      >
        Untriaged
      </span>
    );
  }

  const styles = CATEGORY_STYLES[category];
  const label = EMAIL_THREAD_CATEGORY_LABELS[category];
  const badge = (
    <span
      className={cn(
        'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase',
        styles.border,
        styles.bg,
        styles.text,
        className,
      )}
    >
      {label}
      {typeof confidence === 'number' ? ` · ${Math.round(confidence * 100)}%` : ''}
    </span>
  );

  if (!showWhy || !reason?.trim()) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="inline-flex">
            {badge}
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">
          <p className="font-medium">Why this category?</p>
          <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
            {reason.trim()}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
