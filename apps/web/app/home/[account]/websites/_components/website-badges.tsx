import type { WebsiteStack, WebsiteStatus } from '../_lib/schema/websites.schema';

export const websiteStatusStyles: Record<
  WebsiteStatus,
  { bg: string; text: string; label: string }
> = {
  'in-progress': {
    bg: 'bg-amber-500/15',
    text: 'text-amber-300',
    label: 'In progress',
  },
  live: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-300',
    label: 'Live',
  },
  maintenance: {
    bg: 'bg-orange-500/15',
    text: 'text-orange-300',
    label: 'Maintenance',
  },
  paused: {
    bg: 'bg-slate-500/15',
    text: 'text-[var(--workspace-shell-text-muted)]',
    label: 'Paused',
  },
  archived: {
    bg: 'bg-slate-500/15',
    text: 'text-[var(--workspace-shell-text-muted)]',
    label: 'Archived',
  },
};

export const websiteStackStyles: Record<
  WebsiteStack,
  { bg: string; text: string; label: string }
> = {
  'next-payload': {
    bg: 'bg-[var(--ozer-accent-subtle)]',
    text: 'text-[var(--ozer-accent-muted)]',
    label: 'Next + Payload',
  },
  webflow: {
    bg: 'bg-blue-500/15',
    text: 'text-blue-300',
    label: 'Webflow',
  },
  wordpress: {
    bg: 'bg-indigo-500/15',
    text: 'text-indigo-300',
    label: 'WordPress',
  },
  other: {
    bg: 'bg-slate-500/15',
    text: 'text-[var(--workspace-shell-text-muted)]',
    label: 'Other',
  },
};

export function WebsiteStatusBadge({ status }: { status: WebsiteStatus }) {
  const style =
    websiteStatusStyles[status] ?? websiteStatusStyles['in-progress'];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function WebsiteStackBadge({ stack }: { stack: WebsiteStack }) {
  const style = websiteStackStyles[stack] ?? websiteStackStyles.other;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

export function externalHref(url: string | null | undefined) {
  if (!url?.trim()) return null;
  const value = url.trim();
  return value.startsWith('http') ? value : `https://${value}`;
}

export function formatWebsiteDate(value: string | null | undefined) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
