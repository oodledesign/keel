'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  EMAIL_THREAD_CATEGORY_HINTS,
  EMAIL_THREAD_CATEGORY_LABELS,
  type EmailThreadCategory,
} from '~/lib/email-assistant/email-thread-categories';

import { EMAIL_CATEGORY_STYLES } from '../_lib/email-category-styles';

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

  const styles = EMAIL_CATEGORY_STYLES[category];
  const label = EMAIL_THREAD_CATEGORY_LABELS[category];
  const hint = EMAIL_THREAD_CATEGORY_HINTS[category];
  const whyText = reason?.trim() || hint;
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
      {typeof confidence === 'number'
        ? ` · ${Math.round(confidence * 100)}%`
        : ''}
    </span>
  );

  if (!showWhy) {
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
          <p className="font-medium">{label}</p>
          <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
            {whyText}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
