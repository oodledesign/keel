'use client';

import { useMemo, useState } from 'react';

import { Check, ChevronRight, ListTodo, Mail, X } from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { toast } from '@kit/ui/sonner';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import {
  acceptSuggestedEmailTaskAction,
  dismissSuggestedEmailTaskAction,
} from '~/lib/email-assistant/email-assistant.actions';
import { commitOptimisticUpdate } from '~/lib/tasks/commit-optimistic-update';
import { omitHiddenItems } from '~/lib/tasks/session-task-status';
import { formatDurationMinutes } from '~/lib/tasks/task-duration';

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
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const items = useMemo(
    () => omitHiddenItems(summary.items, hiddenIds),
    [hiddenIds, summary.items],
  );

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
    commitOptimisticUpdate(() => {
      setHiddenIds((prev) => new Set(prev).add(actionItemId));
    });
    void (async () => {
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
      } catch (error) {
        setHiddenIds((prev) => {
          if (!prev.has(actionItemId)) return prev;
          const next = new Set(prev);
          next.delete(actionItemId);
          return next;
        });
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update suggestion',
        );
      }
    })();
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
            return (
              <li
                key={item.id}
                className="flex min-w-0 items-start gap-2 px-3 py-2.5 sm:px-4"
              >
                {item.clientName ? (
                  <ProfileAvatar
                    displayName={item.clientName}
                    pictureUrl={item.clientPictureUrl}
                    className="mt-0.5 h-8 w-8 shrink-0"
                  />
                ) : (
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
                    <Mail className="h-3.5 w-3.5" />
                  </span>
                )}
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {item.title}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {[
                      item.clientName,
                      item.threadSubject,
                      item.emailSentAt
                        ? `sent ${new Date(item.emailSentAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                        : null,
                      item.suggestedDueDate
                        ? `due ${item.suggestedDueDate}`
                        : null,
                      formatDurationMinutes(item.suggestedDurationMinutes),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => runAction(item.id, 'accept')}
                  title="Accept task"
                  aria-label="Accept task"
                  className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] px-2 text-[11px] font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => runAction(item.id, 'dismiss')}
                  title="Dismiss suggestion"
                  aria-label="Dismiss suggestion"
                  className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)]"
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
