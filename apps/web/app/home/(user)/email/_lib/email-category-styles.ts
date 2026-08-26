import type { EmailThreadCategory } from '~/lib/email-assistant/email-thread-categories';

import type { EmailInboxFilter } from './types';

export type EmailCategoryStyle = {
  dot: string;
  border: string;
  bg: string;
  text: string;
  tabActive: string;
};

export const EMAIL_CATEGORY_STYLES: Record<
  EmailThreadCategory,
  EmailCategoryStyle
> = {
  reply_now: {
    dot: 'bg-[var(--ozer-accent)]',
    border: 'border-[var(--ozer-accent)]/30',
    bg: 'bg-[var(--ozer-accent-subtle)]',
    text: 'text-[var(--ozer-accent)]',
    tabActive:
      'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]',
  },
  reply_later: {
    dot: 'bg-amber-500',
    border: 'border-amber-500/30',
    bg: 'bg-amber-500/10',
    text: 'text-amber-700 dark:text-amber-300',
    tabActive: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  waiting: {
    dot: 'bg-sky-500',
    border: 'border-sky-500/30',
    bg: 'bg-sky-500/10',
    text: 'text-sky-700 dark:text-sky-300',
    tabActive: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  fyi: {
    dot: 'bg-[var(--workspace-shell-text-muted)]',
    border: 'border-[color:var(--workspace-shell-border)]',
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]',
    text: 'text-[var(--workspace-shell-text-muted)]',
    tabActive:
      'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]',
  },
  noise: {
    dot: 'bg-[var(--workspace-shell-text-muted)]/60',
    border: 'border-[color:var(--workspace-shell-border)]',
    bg: 'bg-[var(--workspace-shell-sidebar-accent)]/60',
    text: 'text-[var(--workspace-shell-text-muted)]',
    tabActive:
      'bg-[var(--workspace-shell-sidebar-accent)]/80 text-[var(--workspace-shell-text-muted)]',
  },
};

const FOLLOW_UP_FILTER_STYLE = {
  dot: 'bg-violet-500',
  tabActive: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
} as const;

/** Sidebar inbox filter tabs that map to a coloured dot + active tint. */
export const EMAIL_INBOX_FILTER_STYLES: Partial<
  Record<EmailInboxFilter, Pick<EmailCategoryStyle, 'dot' | 'tabActive'>>
> = {
  action: {
    dot: EMAIL_CATEGORY_STYLES.reply_now.dot,
    tabActive: EMAIL_CATEGORY_STYLES.reply_now.tabActive,
  },
  reply_later: {
    dot: EMAIL_CATEGORY_STYLES.reply_later.dot,
    tabActive: EMAIL_CATEGORY_STYLES.reply_later.tabActive,
  },
  waiting: {
    dot: EMAIL_CATEGORY_STYLES.waiting.dot,
    tabActive: EMAIL_CATEGORY_STYLES.waiting.tabActive,
  },
  fyi: {
    dot: EMAIL_CATEGORY_STYLES.fyi.dot,
    tabActive: EMAIL_CATEGORY_STYLES.fyi.tabActive,
  },
  follow_up: FOLLOW_UP_FILTER_STYLE,
};
