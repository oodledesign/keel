'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Check, ChevronRight, ListTodo, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import {
  acceptSuggestedEmailTaskAction,
  dismissSuggestedEmailTaskAction,
} from '~/lib/email-assistant/email-assistant.actions';

import type { DashboardSuggestedEmailTasksSummary } from '../_lib/server/dashboard-page.loader';
import { DashboardPanelTitle } from './dashboard-ui';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type Props = {
  accountSlug: string;
  accountId: string;
  summary: DashboardSuggestedEmailTasksSummary;
};

export function DashboardSuggestedEmailTasksCard({
  accountSlug,
  accountId,
  summary,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(summary.items);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(summary.items);
  }, [summary.items]);

  const reviewHref = pathsConfig.app.accountEmailSuggestedTasks.replace(
    '[account]',
    accountSlug,
  );
  const displayCount = Math.max(
    0,
    summary.totalCount - Math.max(0, summary.items.length - items.length),
  );
  const waitingLabel =
    displayCount === 0
      ? 'No email tasks waiting'
      : displayCount === 1
        ? '1 email task to review'
        : `${displayCount} email tasks to review`;

  function runAction(actionItemId: string, kind: 'accept' | 'dismiss') {
    setPendingIds((prev) => new Set(prev).add(actionItemId));
    startTransition(async () => {
      try {
        if (kind === 'accept') {
          await acceptSuggestedEmailTaskAction({
            actionItemId,
            accountId,
            accountSlug,
          });
          toast.success('Task added to planner');
        } else {
          await dismissSuggestedEmailTaskAction({
            actionItemId,
            accountId,
            accountSlug,
          });
          toast.success('Suggestion dismissed');
        }
        setItems((prev) => prev.filter((item) => item.id !== actionItemId));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update suggestion',
        );
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(actionItemId);
          return next;
        });
      }
    });
  }

  return (
    <section className={panelClass}>
      <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <div className="min-w-0">
          <DashboardPanelTitle icon={ListTodo}>
            Email tasks to review
          </DashboardPanelTitle>
          <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {waitingLabel}
          </p>
        </div>
        <HapticLink href={reviewHref} className={dashboardLinkClass}>
          Review all
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
          <ListTodo className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          No suggested email tasks right now.
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {items.map((item) => {
            const busy = isPending && pendingIds.has(item.id);

            return (
              <li
                key={item.id}
                className="flex min-w-0 items-start gap-2 px-3 py-2.5 sm:px-4"
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {item.threadSubject}
                    {item.emailSentAt
                      ? ` · sent ${new Date(item.emailSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                      : ''}
                    {item.suggestedDueDate
                      ? ` · due ${item.suggestedDueDate}`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(item.id, 'accept')}
                  title="Accept task"
                  aria-label="Accept task"
                  className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] px-2 text-[11px] font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)] disabled:opacity-50"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => runAction(item.id, 'dismiss')}
                  title="Dismiss suggestion"
                  aria-label="Dismiss suggestion"
                  className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
