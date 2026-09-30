'use client';

import type { ReactNode } from 'react';

import { AlertTriangle, Mail, Megaphone, Search } from 'lucide-react';

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import {
  CIRCULATION_STATUS_LABEL,
  type ContactCirculationStatus,
  type ContactCommsSummary,
  type ContactNewsletterStatus,
  NEWSLETTER_STATUS_LABEL,
  NOT_EMAILED_REASON_LABEL,
  describeLastEmail,
  formatRelativeDays,
} from '~/lib/commercial/circulation/contact-comms';

const TONE = {
  green:
    'border-emerald-300 bg-emerald-100 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-900 dark:text-emerald-100',
  amber:
    'border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900 dark:text-amber-100',
  red: 'border-rose-300 bg-rose-100 text-rose-900 dark:border-rose-700 dark:bg-rose-900 dark:text-rose-100',
  grey: 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]',
} as const;

type Tone = keyof typeof TONE;

const CIRCULATION_TONE: Record<ContactCirculationStatus, Tone> = {
  subscribed: 'green',
  paused: 'amber',
  unsubscribed: 'red',
  suppressed: 'red',
  none: 'grey',
};

const NEWSLETTER_TONE: Record<ContactNewsletterStatus, Tone> = {
  subscribed: 'green',
  unsubscribed: 'red',
  suppressed: 'red',
  none: 'grey',
};

const CIRCULATION_HINT: Record<ContactCirculationStatus, string> = {
  subscribed: 'Gets automatic matching-property emails.',
  paused: 'Subscribed, but automatic emails are paused.',
  unsubscribed: 'Opted out of matching-property emails.',
  suppressed: 'Address blocked after a bounce or complaint.',
  none: 'No opt-in yet. Manual sends only; automatic emails go to subscribers only.',
};

function WithTooltip({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Pill({
  tone,
  icon,
  label,
  ariaLabel,
  tooltip,
  focusable = true,
}: {
  tone: Tone;
  icon: ReactNode;
  label: string;
  ariaLabel: string;
  tooltip: ReactNode;
  focusable?: boolean;
}) {
  return (
    <WithTooltip label={tooltip}>
      <span
        role="img"
        tabIndex={focusable ? 0 : undefined}
        aria-label={ariaLabel}
        className={cn(
          'inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold tracking-wide whitespace-nowrap',
          TONE[tone],
        )}
      >
        {icon}
        <span aria-hidden>{label}</span>
      </span>
    </WithTooltip>
  );
}

export function RequirementsPill({
  count,
  activeCount,
  focusable,
}: {
  count: number;
  activeCount: number;
  focusable?: boolean;
}) {
  if (count === 0) return null;
  const label = `${count} requirement${count === 1 ? '' : 's'}`;
  const detail =
    activeCount === count
      ? `${label}, all active`
      : `${label}, ${activeCount} active`;
  return (
    <Pill
      tone={activeCount > 0 ? 'green' : 'grey'}
      icon={<Search aria-hidden className="h-3 w-3" />}
      label={String(count)}
      ariaLabel={detail}
      tooltip={detail}
      focusable={focusable}
    />
  );
}

export function CirculationPill({
  status,
  focusable,
}: {
  status: ContactCirculationStatus;
  focusable?: boolean;
}) {
  const label = CIRCULATION_STATUS_LABEL[status];
  return (
    <Pill
      tone={CIRCULATION_TONE[status]}
      icon={<Mail aria-hidden className="h-3 w-3" />}
      label={status === 'none' ? 'Circ.' : label}
      ariaLabel={`Circulation: ${label}`}
      focusable={focusable}
      tooltip={
        <>
          <span className="font-semibold">Circulation: {label}.</span>{' '}
          {CIRCULATION_HINT[status]}
        </>
      }
    />
  );
}

export function NewsletterPill({
  status,
  focusable,
}: {
  status: ContactNewsletterStatus;
  focusable?: boolean;
}) {
  const label = NEWSLETTER_STATUS_LABEL[status];
  return (
    <Pill
      tone={NEWSLETTER_TONE[status]}
      icon={<Megaphone aria-hidden className="h-3 w-3" />}
      label="News"
      ariaLabel={`Newsletter: ${label}`}
      focusable={focusable}
      tooltip={
        <>
          <span className="font-semibold">Newsletter: {label}.</span> Campaign
          emails from the mailing list.
        </>
      }
    />
  );
}

/**
 * Requirements count, circulation and newsletter consent. Newsletter only
 * shows when the contact is on it or the Email Campaigns add-on is on.
 */
export function ContactCommsPills({
  comms,
  requirementCount,
  showCirculation,
  showNewsletter,
  hideRequirementCount = false,
  focusable = true,
  className,
}: {
  comms: ContactCommsSummary | null;
  requirementCount: number;
  showCirculation: boolean;
  showNewsletter: boolean;
  /** The list view already has a Requirements column. */
  hideRequirementCount?: boolean;
  /** False inside links, where a focusable trigger would nest interactive content. */
  focusable?: boolean;
  className?: string;
}) {
  if (!comms) return null;
  const newsletterVisible =
    showNewsletter || comms.newsletterStatus === 'subscribed';
  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {showCirculation && !hideRequirementCount ? (
        <RequirementsPill
          count={requirementCount}
          activeCount={comms.activeRequirementCount}
          focusable={focusable}
        />
      ) : null}
      {showCirculation &&
      (requirementCount > 0 || comms.circulationStatus !== 'none') ? (
        <CirculationPill
          status={comms.circulationStatus}
          focusable={focusable}
        />
      ) : null}
      {newsletterVisible ? (
        <NewsletterPill status={comms.newsletterStatus} focusable={focusable} />
      ) : null}
    </div>
  );
}

export function NotEmailedHint({
  comms,
  className,
  focusable = true,
}: {
  comms: ContactCommsSummary | null;
  className?: string;
  focusable?: boolean;
}) {
  if (!comms?.notEmailedReason) return null;
  const reason = NOT_EMAILED_REASON_LABEL[comms.notEmailedReason];
  return (
    <WithTooltip label={`Not in the next circulation: ${reason}`}>
      <span
        role="img"
        aria-label={`Not in the next circulation: ${reason}`}
        tabIndex={focusable ? 0 : undefined}
        className={cn(
          'inline-flex text-amber-600 dark:text-amber-400',
          className,
        )}
      >
        <AlertTriangle aria-hidden className="h-3.5 w-3.5" />
      </span>
    </WithTooltip>
  );
}

export function LastEmailedLabel({
  comms,
  className,
}: {
  comms: ContactCommsSummary | null;
  className?: string;
}) {
  const lastEmail = comms?.lastEmail ?? null;
  if (!lastEmail) {
    return (
      <span
        className={cn('text-[var(--workspace-shell-text-muted)]', className)}
      >
        Never
      </span>
    );
  }
  const summary = describeLastEmail(lastEmail);
  return (
    <WithTooltip label={summary}>
      <span
        tabIndex={0}
        suppressHydrationWarning
        aria-label={`Last emailed: ${summary}`}
        className={cn(
          'cursor-default underline decoration-dotted underline-offset-2',
          className,
        )}
      >
        {formatRelativeDays(lastEmail.sentAt)}
      </span>
    </WithTooltip>
  );
}
