'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  LOW_CONFIDENCE_ASSIGNEE_THRESHOLD,
  isHighConfidenceMeetingSuggestion,
} from '~/lib/recorder/meeting-task-confidence';
import type { AccountTaskAutomationSettings } from '~/lib/recorder/task-automation-settings';

import {
  approveMeetingActionItem,
  bulkApproveHighConfidenceMeetingItems,
  rejectMeetingActionItem,
} from '../_lib/server/meeting-review-actions';
import type {
  MeetingReviewItem,
  MeetingReviewMember,
} from '../_lib/server/meeting-review.loader';

type Props = {
  accountId: string;
  accountSlug: string;
  initialItems: MeetingReviewItem[];
  members: MeetingReviewMember[];
  automationSettings: AccountTaskAutomationSettings;
};

type ItemDraft = {
  title: string;
  description: string;
  dueDate: string;
  assigneeId: string;
};

function formatDueDate(value: string | null): string {
  if (!value) return 'No due date';
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Design-system aligned confidence pills for light cream surfaces. */
function confidenceBadgeClass(confidence: number | null): string {
  if (confidence === null) {
    return 'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text-muted)]';
  }

  if (confidence < LOW_CONFIDENCE_ASSIGNEE_THRESHOLD) {
    return 'border-amber-600/25 bg-amber-50 text-amber-800';
  }

  if (confidence >= 0.75) {
    return 'border-[color:color-mix(in_srgb,var(--ozer-accent)_30%,transparent)] bg-[var(--ozer-accent-subtle)] text-[var(--ozer-accent)]';
  }

  return 'border-[color:color-mix(in_srgb,var(--ozer-info)_30%,transparent)] bg-[color-mix(in_srgb,var(--ozer-info)_10%,white)] text-[var(--ozer-info)]';
}

function confidenceLabel(confidence: number | null): string {
  if (confidence === null) {
    return 'Assignee unknown';
  }

  const pct = Math.round(confidence * 100);
  if (confidence < LOW_CONFIDENCE_ASSIGNEE_THRESHOLD) {
    return `Low confidence ${pct}%`;
  }

  return `Confidence ${pct}%`;
}

function buildDraft(item: MeetingReviewItem): ItemDraft {
  return {
    title: item.suggestedTitle,
    description: item.suggestedDescription ?? '',
    dueDate: item.suggestedDueDate ?? '',
    assigneeId: item.suggestedAssigneeId ?? '',
  };
}

export function MeetingTaskReviewClient({
  accountId,
  accountSlug,
  initialItems,
  members,
  automationSettings,
}: Props) {
  const [items, setItems] = useState(initialItems);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingIds, setEditingIds] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Record<string, ItemDraft>>(() =>
    Object.fromEntries(initialItems.map((item) => [item.id, buildDraft(item)])),
  );
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkPending, setBulkPending] = useState(false);
  const [, startTransition] = useTransition();

  const tasksPath = workAccountPath(pathsConfig.app.accountTasks, accountSlug);
  const settingsPath = workAccountPath(
    pathsConfig.app.accountTaskAutomationSettings,
    accountSlug,
  );
  const meetingModeLabel =
    automationSettings.meetingTasksMode === 'auto_publish'
      ? 'Auto-publish enabled'
      : 'Require my review';

  const highConfidenceItems = useMemo(
    () => items.filter((item) => isHighConfidenceMeetingSuggestion(item)),
    [items],
  );

  function updateDraft(itemId: string, patch: Partial<ItemDraft>) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...current[itemId]!,
        ...patch,
      },
    }));
  }

  function toggleExpanded(itemId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function toggleEditing(itemId: string, item: MeetingReviewItem) {
    setEditingIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
        setExpandedIds((expanded) => new Set(expanded).add(itemId));
        updateDraft(itemId, buildDraft(item));
      }
      return next;
    });
  }

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
    setEditingIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
    setExpandedIds((current) => {
      const next = new Set(current);
      next.delete(itemId);
      return next;
    });
  }

  function approveItem(item: MeetingReviewItem, edited: boolean) {
    const draft = drafts[item.id] ?? buildDraft(item);

    if (!draft.assigneeId) {
      toast.error('Choose an assignee before approving.');
      setExpandedIds((current) => new Set(current).add(item.id));
      return;
    }

    if (!draft.title.trim()) {
      toast.error('Task title is required.');
      return;
    }

    setPendingId(item.id);
    startTransition(async () => {
      try {
        await approveMeetingActionItem({
          accountId,
          accountSlug,
          meetingActionItemId: item.id,
          assigneeId: draft.assigneeId,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          dueDate: draft.dueDate.trim() || null,
        });
        toast.success(
          edited
            ? 'Task updated and added to planner'
            : 'Task added to planner',
        );
        removeItem(item.id);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not approve suggestion',
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function rejectItem(item: MeetingReviewItem) {
    setPendingId(item.id);
    startTransition(async () => {
      try {
        await rejectMeetingActionItem({
          accountId,
          accountSlug,
          meetingActionItemId: item.id,
        });
        toast.success('Suggestion rejected');
        removeItem(item.id);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not reject suggestion',
        );
      } finally {
        setPendingId(null);
      }
    });
  }

  function bulkApprove() {
    if (highConfidenceItems.length === 0) {
      toast.message('No high-confidence suggestions to approve.');
      return;
    }

    setBulkPending(true);
    startTransition(async () => {
      try {
        const result = await bulkApproveHighConfidenceMeetingItems({
          accountId,
          accountSlug,
        });
        toast.success(
          result.publishedCount > 0
            ? `Added ${result.publishedCount} task${result.publishedCount === 1 ? '' : 's'} to the planner`
            : 'No high-confidence suggestions to approve',
        );
        setItems((current) =>
          current.filter((item) => !isHighConfidenceMeetingSuggestion(item)),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Bulk approve failed',
        );
      } finally {
        setBulkPending(false);
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5">
      <div>
        <Link
          href={tasksPath}
          className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to tasks
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--workspace-shell-text)]">
              Meeting task review
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--workspace-shell-text-muted)]">
              Approve AI-suggested action items from recorded meetings. Assign
              an owner before publishing anything with unclear ownership.
            </p>
          </div>
          {highConfidenceItems.length > 0 ? (
            <Button
              type="button"
              onClick={bulkApprove}
              disabled={bulkPending || pendingId !== null}
              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
            >
              {bulkPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving…
                </>
              ) : (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Approve {highConfidenceItems.length} high-confidence
                </>
              )}
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-4 py-2.5 text-sm text-[var(--workspace-shell-text-muted)]">
        Meeting tasks:{' '}
        <span className="text-[var(--workspace-shell-text)]">
          {meetingModeLabel}
        </span>
        {automationSettings.autoScheduleOnCalendar ? (
          <span> · Calendar auto-scheduling on</span>
        ) : null}
        .{' '}
        <Link
          href={settingsPath}
          className="font-medium text-[var(--ozer-accent)] hover:underline"
        >
          Change automation settings
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-8 text-center">
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            No meeting tasks waiting for review.
          </p>
          <p className="mt-2 text-xs text-[var(--workspace-shell-text-muted)]">
            New suggestions appear here after KeelAssistant syncs a meeting
            transcript.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          {items.map((item, index) => {
            const draft = drafts[item.id] ?? buildDraft(item);
            const isExpanded = expandedIds.has(item.id);
            const isEditing = editingIds.has(item.id);
            const isPending = pendingId === item.id;
            const meetingHref = workAccountPath(
              pathsConfig.app.accountMeetingDetail,
              accountSlug,
            ).replace('[transcriptId]', item.meetingTranscriptId);
            const needsAssignment = !draft.assigneeId;
            const assigneeName = members.find(
              (m) => m.userId === draft.assigneeId,
            )?.name;

            return (
              <article
                key={item.id}
                className={cn(
                  index > 0 &&
                    'border-t border-[color:var(--workspace-shell-border)]',
                )}
              >
                <div className="flex items-stretch gap-2 px-3 py-2.5 sm:gap-3 sm:px-4">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-start gap-3 text-left"
                    onClick={() => toggleExpanded(item.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className="mt-1 text-[var(--workspace-shell-text-muted)]">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </span>

                    {item.clientName ? (
                      <span className="mt-0.5 inline-flex shrink-0">
                        <ProfileAvatar
                          displayName={item.clientName}
                          pictureUrl={item.clientPictureUrl}
                          className="h-8 w-8"
                        />
                      </span>
                    ) : null}

                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold text-[var(--workspace-shell-text)]">
                          {draft.title || item.suggestedTitle}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'h-5 px-1.5 text-[10px] font-medium',
                            confidenceBadgeClass(item.assigneeConfidence),
                          )}
                        >
                          {confidenceLabel(item.assigneeConfidence)}
                        </Badge>
                        {needsAssignment ? (
                          <Badge
                            variant="outline"
                            className="h-5 border-amber-600/25 bg-amber-50 px-1.5 text-[10px] text-amber-800"
                          >
                            <AlertCircle className="mr-0.5 h-3 w-3" />
                            Needs assignee
                          </Badge>
                        ) : null}
                      </span>
                      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                        {item.clientName ? (
                          <span className="truncate">{item.clientName}</span>
                        ) : null}
                        <span className="truncate">
                          {item.meetingTitle}
                          {item.meetingDate
                            ? ` · ${formatDueDate(item.meetingDate)}`
                            : ''}
                        </span>
                        {assigneeName ? (
                          <span className="truncate">→ {assigneeName}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>

                  <div
                    className="flex shrink-0 items-center gap-2"
                    onClick={(event) => event.stopPropagation()}
                    onKeyDown={(event) => event.stopPropagation()}
                  >
                    <label className="hidden items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)] md:inline-flex">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <Input
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) =>
                          updateDraft(item.id, {
                            dueDate: event.target.value,
                          })
                        }
                        className="h-8 w-[140px] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] px-2 text-xs text-[var(--workspace-shell-text)]"
                        aria-label="Due date"
                      />
                    </label>

                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                      disabled={isPending || bulkPending}
                      onClick={() => rejectItem(item)}
                    >
                      <X className="h-4 w-4" />
                      <span className="sr-only">Reject</span>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="h-8 bg-[var(--ozer-accent)] px-3 text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                      disabled={isPending || bulkPending}
                      onClick={() => approveItem(item, Boolean(draft.dueDate))}
                    >
                      {isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        'Approve'
                      )}
                    </Button>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="space-y-4 border-t border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-4 py-4 sm:px-5">
                    <div className="flex flex-wrap items-center gap-3 md:hidden">
                      <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                        Due date
                      </Label>
                      <Input
                        type="date"
                        value={draft.dueDate}
                        onChange={(event) =>
                          updateDraft(item.id, {
                            dueDate: event.target.value,
                          })
                        }
                        className="h-9 max-w-[180px] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
                      />
                    </div>

                    {item.clientName ? (
                      <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]">
                        <ProfileAvatar
                          displayName={item.clientName}
                          pictureUrl={item.clientPictureUrl}
                          className="h-7 w-7"
                        />
                        <span className="font-medium">{item.clientName}</span>
                      </div>
                    ) : null}

                    {!isEditing ? (
                      <>
                        {item.suggestedDescription ? (
                          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                            {item.suggestedDescription}
                          </p>
                        ) : null}
                        {item.sourceExcerpt ? (
                          <blockquote className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/70 px-3 py-2 text-sm text-[var(--workspace-shell-text-muted)] italic">
                            “{item.sourceExcerpt}”
                          </blockquote>
                        ) : null}
                      </>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[var(--workspace-shell-text-muted)]">
                            Title
                          </Label>
                          <Input
                            value={draft.title}
                            onChange={(event) =>
                              updateDraft(item.id, {
                                title: event.target.value,
                              })
                            }
                            className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
                          />
                        </div>
                        <div className="space-y-2 sm:col-span-2">
                          <Label className="text-[var(--workspace-shell-text-muted)]">
                            Description
                          </Label>
                          <Textarea
                            value={draft.description}
                            onChange={(event) =>
                              updateDraft(item.id, {
                                description: event.target.value,
                              })
                            }
                            className="min-h-[88px] border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <Link
                        href={meetingHref}
                        className="inline-flex items-center gap-1 text-sm text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
                      >
                        From: {item.meetingTitle}
                        {item.meetingDate
                          ? ` · ${formatDueDate(item.meetingDate)}`
                          : ''}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>

                      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                        <div className="min-w-[200px] space-y-1">
                          <Label className="text-xs text-[var(--workspace-shell-text-muted)]">
                            Assignee
                          </Label>
                          <Select
                            value={draft.assigneeId || '__none__'}
                            onValueChange={(value) =>
                              updateDraft(item.id, {
                                assigneeId: value === '__none__' ? '' : value,
                              })
                            }
                          >
                            <SelectTrigger className="h-9 border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
                              <SelectValue placeholder="Choose assignee" />
                            </SelectTrigger>
                            <SelectContent className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-panel)] text-[var(--workspace-shell-text)]">
                              <SelectItem value="__none__">
                                Unassigned
                              </SelectItem>
                              {members.map((member) => (
                                <SelectItem
                                  key={member.userId}
                                  value={member.userId}
                                >
                                  {member.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)]"
                            disabled={isPending || bulkPending}
                            onClick={() => toggleEditing(item.id, item)}
                          >
                            <Pencil className="mr-1 h-3.5 w-3.5" />
                            {isEditing ? 'Cancel edit' : 'Edit details'}
                          </Button>
                          {isEditing ? (
                            <Button
                              type="button"
                              size="sm"
                              className="bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                              disabled={isPending || bulkPending}
                              onClick={() => approveItem(item, true)}
                            >
                              {isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Saving…
                                </>
                              ) : (
                                'Save & approve'
                              )}
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
