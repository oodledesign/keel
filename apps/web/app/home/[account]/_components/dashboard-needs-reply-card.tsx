'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ChevronRight, Mail, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import { ignoreEmailNeedsReplyAction } from '~/lib/email-assistant/email-assistant.actions';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';

import type { DashboardNeedsReplyThread } from '../_lib/server/dashboard-page.loader';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type Props = {
  accountSlug: string;
  accountId: string;
  threads: DashboardNeedsReplyThread[];
  totalCount: number;
};

export function DashboardNeedsReplyCard({
  accountSlug,
  accountId,
  threads,
  totalCount,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(threads);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(threads);
  }, [threads]);

  const emailHref = `${pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)}?filter=needs_reply`;
  const displayCount = Math.max(
    0,
    totalCount - Math.max(0, threads.length - items.length),
  );
  const waitingLabel =
    displayCount === 0
      ? 'You are caught up'
      : displayCount === 1
        ? '1 email waiting'
        : `${displayCount} emails waiting`;

  function ignoreThread(threadId: string) {
    setPendingIds((prev) => new Set(prev).add(threadId));
    startTransition(async () => {
      try {
        await ignoreEmailNeedsReplyAction({
          threadId,
          accountId,
          accountSlug,
        });
        setItems((prev) => prev.filter((thread) => thread.id !== threadId));
        toast.success('Marked as no reply needed');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not ignore this email',
        );
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(threadId);
          return next;
        });
      }
    });
  }

  return (
    <section className={cn(panelClass, 'xl:col-span-2')}>
      <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            Needs a reply
          </h2>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {waitingLabel}
          </p>
        </div>
        <HapticLink href={emailHref} className={dashboardLinkClass}>
          Open inbox
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
          <Mail className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          No emails need a reply right now.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {items.map((thread) => {
            const href = `${pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)}?thread=${thread.id}`;
            const ignoring = isPending && pendingIds.has(thread.id);

            return (
              <li
                key={thread.id}
                className="flex min-w-0 items-start gap-2 px-3 py-2.5 sm:px-4"
              >
                <HapticLink
                  href={href}
                  className="min-w-0 flex-1 overflow-hidden rounded-lg px-1 py-0.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <div className="flex min-w-0 items-baseline justify-between gap-2">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {thread.fromLabel}
                    </p>
                    <span className="shrink-0 text-[10px] tabular-nums text-[var(--workspace-shell-text-muted)]">
                      {formatEmailDateTime(thread.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-[var(--workspace-shell-text)]">
                    {thread.subject}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {[thread.clientName, thread.snippet]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </HapticLink>
                <button
                  type="button"
                  onClick={() => ignoreThread(thread.id)}
                  disabled={ignoring}
                  title="Ignore — no reply needed"
                  aria-label="Ignore — no reply needed"
                  className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                  Ignore
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
