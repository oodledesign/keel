'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import {
  Check,
  CheckSquare,
  ChevronRight,
  ListTodo,
  Mail,
  Mic,
  X,
} from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import {
  acceptSuggestedEmailTaskAction,
  dismissSuggestedEmailTaskAction,
} from '~/lib/email-assistant/email-assistant.actions';

import type {
  DashboardMeetingReviewSummary,
  DashboardSuggestedEmailTasksSummary,
  DashboardTaskSummary,
} from '../_lib/server/dashboard-page.loader';
import { DashboardPanelTitle } from './dashboard-ui';
import { DashboardUpcomingTaskItem } from './dashboard-upcoming-task-item';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

const dashboardLinkClass =
  'flex items-center gap-0.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]';

type TabId = 'upcoming' | 'meeting' | 'email';

type Props = {
  accountSlug: string;
  accountId: string;
  upcomingTasks: DashboardTaskSummary[];
  upcomingTasksTotalCount: number;
  meetingTaskReview: DashboardMeetingReviewSummary;
  suggestedEmailTasks: DashboardSuggestedEmailTasksSummary;
  density?: 'sm' | 'md' | 'lg';
};

export function DashboardTasksTabsCard({
  accountSlug,
  accountId,
  upcomingTasks,
  upcomingTasksTotalCount,
  meetingTaskReview,
  suggestedEmailTasks,
  density = 'md',
}: Props) {
  const router = useRouter();
  const [emailItems, setEmailItems] = useState(suggestedEmailTasks.items);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setEmailItems(suggestedEmailTasks.items);
  }, [suggestedEmailTasks.items]);

  const emailCount = Math.max(
    0,
    suggestedEmailTasks.totalCount -
      Math.max(0, suggestedEmailTasks.items.length - emailItems.length),
  );

  const defaultTab = useMemo((): TabId => {
    if (upcomingTasksTotalCount > 0) return 'upcoming';
    if (meetingTaskReview.totalCount > 0) return 'meeting';
    if (emailCount > 0) return 'email';
    return 'upcoming';
  }, [emailCount, meetingTaskReview.totalCount, upcomingTasksTotalCount]);

  const [tab, setTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    const countForCurrentTab =
      tab === 'upcoming'
        ? upcomingTasksTotalCount
        : tab === 'meeting'
          ? meetingTaskReview.totalCount
          : emailCount;
    if (countForCurrentTab === 0) {
      setTab(defaultTab);
    }
  }, [
    defaultTab,
    emailCount,
    meetingTaskReview.totalCount,
    tab,
    upcomingTasksTotalCount,
  ]);

  const tasksHref = pathsConfig.app.accountTasks.replace(
    '[account]',
    accountSlug,
  );
  const meetingReviewHref = pathsConfig.app.accountTasksReview.replace(
    '[account]',
    accountSlug,
  );
  const emailReviewHref = pathsConfig.app.accountEmailSuggestedTasks.replace(
    '[account]',
    accountSlug,
  );

  const viewAllHref =
    tab === 'meeting'
      ? meetingReviewHref
      : tab === 'email'
        ? emailReviewHref
        : tasksHref;

  function runEmailAction(actionItemId: string, kind: 'accept' | 'dismiss') {
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
        setEmailItems((prev) =>
          prev.filter((item) => item.id !== actionItemId),
        );
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

  const tabs: Array<{
    id: TabId;
    label: string;
    count: number;
    icon: typeof ListTodo;
  }> = [
    {
      id: 'upcoming',
      label: 'Upcoming',
      count: upcomingTasksTotalCount,
      icon: ListTodo,
    },
    {
      id: 'meeting',
      label: 'Meeting review',
      count: meetingTaskReview.totalCount,
      icon: Mic,
    },
    { id: 'email', label: 'Email review', count: emailCount, icon: Mail },
  ];

  return (
    <section className={cn(panelClass, density === 'lg' && 'xl:col-span-2')}>
      <div className="flex items-center justify-between border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
        <DashboardPanelTitle icon={CheckSquare}>Tasks</DashboardPanelTitle>
        <HapticLink href={viewAllHref} className={dashboardLinkClass}>
          View all
          <ChevronRight className="h-3.5 w-3.5" />
        </HapticLink>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--workspace-shell-border)] px-3 pt-2">
        {tabs.map((entry) => {
          const active = tab === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-xs font-medium transition-colors',
                active
                  ? 'border-b-2 border-[var(--ozer-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]',
              )}
            >
              <entry.icon className="h-3.5 w-3.5 shrink-0" />
              {entry.label}
              <span
                className={cn(
                  'inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  entry.count > 0
                    ? 'bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]'
                    : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
                )}
              >
                {entry.count}
              </span>
            </button>
          );
        })}
      </div>

      {tab === 'upcoming' ? (
        <ul className="space-y-2 p-3">
          {upcomingTasks.length === 0 ? (
            <li className="px-1 py-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No upcoming tasks.
            </li>
          ) : (
            upcomingTasks.map((task) => (
              <DashboardUpcomingTaskItem
                key={task.id}
                task={task}
                workspaceAccountId={accountId}
              />
            ))
          )}
        </ul>
      ) : null}

      {tab === 'meeting' ? (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
          {meetingTaskReview.items.length === 0 ? (
            <li className="px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
              No meeting tasks waiting for review.
            </li>
          ) : (
            meetingTaskReview.items.map((item) => (
              <li key={item.id}>
                <HapticLink
                  href={meetingReviewHref}
                  className="flex items-start gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  {item.clientName ? (
                    <ProfileAvatar
                      displayName={item.clientName}
                      pictureUrl={item.clientPictureUrl}
                      className="mt-0.5 h-8 w-8 shrink-0"
                    />
                  ) : (
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
                      <Mic className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {item.suggestedTitle}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {[
                        item.clientName,
                        item.meetingTitle,
                        item.suggestedDueDate
                          ? `due ${item.suggestedDueDate}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </span>
                </HapticLink>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {tab === 'email' ? (
        emailItems.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
            <ListTodo className="h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
            No suggested email tasks right now.
          </div>
        ) : (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
            {emailItems.map((item) => {
              const busy = isPending && pendingIds.has(item.id);
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
                        item.suggestedDueDate
                          ? `due ${item.suggestedDueDate}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runEmailAction(item.id, 'accept')}
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
                    onClick={() => runEmailAction(item.id, 'dismiss')}
                    title="Dismiss suggestion"
                    aria-label="Dismiss suggestion"
                    className="mt-0.5 inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : null}
    </section>
  );
}
