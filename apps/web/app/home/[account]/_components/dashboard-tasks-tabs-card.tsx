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
import { parseDueDateParts } from '~/home/_lib/due-date-ymd';
import {
  acceptSuggestedEmailTaskAction,
  dismissSuggestedEmailTaskAction,
} from '~/lib/email-assistant/email-assistant.actions';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';

import {
  approveMeetingActionItem,
  rejectMeetingActionItem,
} from '../tasks/review/_lib/server/meeting-review-actions';
import type {
  DashboardMeetingReviewItem,
  DashboardMeetingReviewSummary,
  DashboardSuggestedEmailTask,
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

function formatSuggestedDueDate(value: string | null | undefined): string | null {
  const parts = parseDueDateParts(value);
  if (!parts) return null;

  return new Date(parts.y, parts.m - 1, parts.d, 12, 0, 0).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  );
}

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
  const [meetingItems, setMeetingItems] = useState(meetingTaskReview.items);
  const [emailItems, setEmailItems] = useState(suggestedEmailTasks.items);
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMeetingItems(meetingTaskReview.items);
  }, [meetingTaskReview.items]);

  useEffect(() => {
    setEmailItems(suggestedEmailTasks.items);
  }, [suggestedEmailTasks.items]);

  const meetingCount = Math.max(
    0,
    meetingTaskReview.totalCount -
      Math.max(0, meetingTaskReview.items.length - meetingItems.length),
  );

  const emailCount = Math.max(
    0,
    suggestedEmailTasks.totalCount -
      Math.max(0, suggestedEmailTasks.items.length - emailItems.length),
  );

  const defaultTab = useMemo((): TabId => {
    if (upcomingTasksTotalCount > 0) return 'upcoming';
    if (meetingCount > 0) return 'meeting';
    if (emailCount > 0) return 'email';
    return 'upcoming';
  }, [emailCount, meetingCount, upcomingTasksTotalCount]);

  const [tab, setTab] = useState<TabId>(defaultTab);

  useEffect(() => {
    const countForCurrentTab =
      tab === 'upcoming'
        ? upcomingTasksTotalCount
        : tab === 'meeting'
          ? meetingCount
          : emailCount;
    if (countForCurrentTab === 0) {
      setTab(defaultTab);
    }
  }, [defaultTab, emailCount, meetingCount, tab, upcomingTasksTotalCount]);

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

  function markPending(id: string, active: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev);
      if (active) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function runMeetingAction(
    item: DashboardMeetingReviewItem,
    kind: 'accept' | 'decline',
  ) {
    if (kind === 'accept' && !item.suggestedAssigneeId) {
      toast.error('Open meeting review to choose an assignee first');
      return;
    }

    markPending(item.id, true);
    startTransition(async () => {
      try {
        if (kind === 'accept') {
          await approveMeetingActionItem({
            accountId,
            accountSlug,
            meetingActionItemId: item.id,
            assigneeId: item.suggestedAssigneeId as string,
            title: item.suggestedTitle,
            dueDate: item.suggestedDueDate,
          });
          toast.success('Task added to planner');
        } else {
          await rejectMeetingActionItem({
            accountId,
            accountSlug,
            meetingActionItemId: item.id,
          });
          toast.success('Suggestion declined');
        }
        setMeetingItems((prev) => prev.filter((row) => row.id !== item.id));
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update meeting suggestion',
        );
      } finally {
        markPending(item.id, false);
      }
    });
  }

  function runEmailAction(actionItemId: string, kind: 'accept' | 'dismiss') {
    markPending(actionItemId, true);
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
        setExpandedEmailId((current) =>
          current === actionItemId ? null : current,
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update suggestion',
        );
      } finally {
        markPending(actionItemId, false);
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
      count: meetingCount,
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
          {meetingItems.length === 0 ? (
            <li className="px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
              No meeting tasks waiting for review.
            </li>
          ) : (
            meetingItems.map((item) => {
              const busy = isPending && pendingIds.has(item.id);
              const dueLabel = formatSuggestedDueDate(item.suggestedDueDate);

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
                      <Mic className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 overflow-hidden">
                    <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {item.suggestedTitle}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {[
                        item.clientName,
                        item.meetingTitle,
                        dueLabel ? `due ${dueLabel}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runMeetingAction(item, 'accept')}
                    title={
                      item.suggestedAssigneeId
                        ? 'Accept task'
                        : 'Open meeting review to choose an assignee'
                    }
                    aria-label="Accept meeting task"
                    className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] px-2 text-[11px] font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runMeetingAction(item, 'decline')}
                    title="Decline suggestion"
                    aria-label="Decline meeting task"
                    className="mt-0.5 inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    Decline
                  </button>
                </li>
              );
            })
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
            {emailItems.map((item) => (
              <EmailReviewRow
                key={item.id}
                item={item}
                busy={isPending && pendingIds.has(item.id)}
                expanded={expandedEmailId === item.id}
                onToggleExpand={() =>
                  setExpandedEmailId((current) =>
                    current === item.id ? null : item.id,
                  )
                }
                onAccept={() => runEmailAction(item.id, 'accept')}
                onDismiss={() => runEmailAction(item.id, 'dismiss')}
              />
            ))}
          </ul>
        )
      ) : null}
    </section>
  );
}

function EmailReviewRow({
  item,
  busy,
  expanded,
  onToggleExpand,
  onAccept,
  onDismiss,
}: {
  item: DashboardSuggestedEmailTask;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const dueLabel = formatSuggestedDueDate(item.suggestedDueDate);
  const sentLabel = formatEmailDateTime(item.emailSentAt);

  return (
    <li className="px-3 py-2.5 sm:px-4">
      <div className="flex min-w-0 items-start gap-2">
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
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          className="min-w-0 flex-1 overflow-hidden rounded-md text-left transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]/60"
        >
          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
            {item.title}
          </p>
          <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
            {[
              item.clientName,
              item.threadSubject,
              dueLabel ? `due ${dueLabel}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onAccept}
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
          onClick={onDismiss}
          title="Dismiss suggestion"
          aria-label="Dismiss suggestion"
          className="mt-0.5 inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--workspace-shell-border)] px-2 text-[11px] font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 ml-10 space-y-1.5 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-3 py-2.5">
          {item.detail ? (
            <p className="text-sm leading-relaxed text-[var(--workspace-shell-text)]">
              {item.detail}
            </p>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text-muted)]">
              No extra task detail from this email.
            </p>
          )}
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Thread: {item.threadSubject || '(no subject)'}
          </p>
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            Due: {dueLabel ?? 'No due date suggested'}
            {sentLabel ? ` · Sent ${sentLabel}` : ''}
          </p>
        </div>
      ) : null}
    </li>
  );
}
