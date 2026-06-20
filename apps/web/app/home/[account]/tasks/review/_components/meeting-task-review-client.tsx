'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  AlertCircle,
  CalendarDays,
  Check,
  ChevronLeft,
  ExternalLink,
  Loader2,
  Pencil,
  X,
} from 'lucide-react';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import {
  isHighConfidenceMeetingSuggestion,
  LOW_CONFIDENCE_ASSIGNEE_THRESHOLD,
} from '~/lib/recorder/meeting-task-confidence';

import type {
  MeetingReviewItem,
  MeetingReviewMember,
} from '../_lib/server/meeting-review.loader';
import {
  approveMeetingActionItem,
  bulkApproveHighConfidenceMeetingItems,
  rejectMeetingActionItem,
} from '../_lib/server/meeting-review-actions';
import type { AccountTaskAutomationSettings } from '~/lib/recorder/task-automation-settings';

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

function confidenceBadgeClass(confidence: number | null): string {
  if (confidence === null) {
    return 'border-zinc-600/40 bg-zinc-800/60 text-zinc-300';
  }

  if (confidence < LOW_CONFIDENCE_ASSIGNEE_THRESHOLD) {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-200';
  }

  if (confidence >= 0.75) {
    return 'border-[var(--keel-teal)]/40 bg-[var(--keel-teal)]/10 text-teal-200';
  }

  return 'border-blue-500/30 bg-blue-500/10 text-blue-200';
}

function confidenceLabel(confidence: number | null): string {
  if (confidence === null) {
    return 'Assignee unknown';
  }

  const pct = Math.round(confidence * 100);
  if (confidence < LOW_CONFIDENCE_ASSIGNEE_THRESHOLD) {
    return `Low assignee confidence (${pct}%)`;
  }

  return `Assignee confidence ${pct}%`;
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

  function toggleEditing(itemId: string, item: MeetingReviewItem) {
    setEditingIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
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
  }

  function approveItem(item: MeetingReviewItem, edited: boolean) {
    const draft = drafts[item.id] ?? buildDraft(item);

    if (!draft.assigneeId) {
      toast.error('Choose an assignee before approving.');
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
        toast.success(edited ? 'Task updated and added to planner' : 'Task added to planner');
        removeItem(item.id);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not approve suggestion',
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
          error instanceof Error ? error.message : 'Could not reject suggestion',
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
          current.filter(
            (item) => !isHighConfidenceMeetingSuggestion(item),
          ),
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
    <div className={cn('mx-auto max-w-4xl space-y-6 px-4 py-6 md:px-8 md:py-8')}>
      <div>
        <Link
          href={tasksPath}
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to tasks
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Meeting task review
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-zinc-400">
              Approve AI-suggested action items from recorded meetings. Assign an owner
              before publishing anything with unclear ownership.
            </p>
          </div>
          {highConfidenceItems.length > 0 ? (
            <Button
              type="button"
              onClick={bulkApprove}
              disabled={bulkPending || pendingId !== null}
              className="bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
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

      <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] px-4 py-3 text-sm text-zinc-300">
        Meeting tasks: <span className="text-white">{meetingModeLabel}</span>
        {automationSettings.autoScheduleOnCalendar ? (
          <span className="text-zinc-500"> · Calendar auto-scheduling on</span>
        ) : null}
        .{' '}
        <Link href={settingsPath} className="font-medium text-[var(--keel-teal)] hover:underline">
          Change automation settings
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-8 text-center">
          <p className="text-sm text-zinc-300">No meeting tasks waiting for review.</p>
          <p className="mt-2 text-xs text-zinc-500">
            New suggestions appear here after KeelAssistant syncs a meeting transcript.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => {
            const draft = drafts[item.id] ?? buildDraft(item);
            const isEditing = editingIds.has(item.id);
            const isPending = pendingId === item.id;
            const meetingHref = workAccountPath(
              pathsConfig.app.accountMeetingDetail,
              accountSlug,
            ).replace('[transcriptId]', item.meetingTranscriptId);
            const needsAssignment = !draft.assigneeId;

            return (
              <article
                key={item.id}
                className="rounded-2xl border border-white/10 bg-[var(--workspace-shell-panel)] p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="outline"
                        className={confidenceBadgeClass(item.assigneeConfidence)}
                      >
                        {confidenceLabel(item.assigneeConfidence)}
                      </Badge>
                      {needsAssignment ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-amber-200"
                        >
                          <AlertCircle className="mr-1 h-3 w-3" />
                          Needs assignment
                        </Badge>
                      ) : null}
                    </div>
                    {!isEditing ? (
                      <>
                        <h2 className="text-lg font-semibold text-white">
                          {item.suggestedTitle}
                        </h2>
                        {item.suggestedDescription ? (
                          <p className="text-sm text-zinc-300">
                            {item.suggestedDescription}
                          </p>
                        ) : null}
                        <p className="inline-flex items-center gap-1 text-xs text-zinc-500">
                          <CalendarDays className="h-3.5 w-3.5" />
                          {formatDueDate(item.suggestedDueDate)}
                        </p>
                      </>
                    ) : (
                      <div className="space-y-3 pt-1">
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Title</Label>
                          <Input
                            value={draft.title}
                            onChange={(event) =>
                              updateDraft(item.id, { title: event.target.value })
                            }
                            className="border-white/10 bg-[#0B132B] text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Description</Label>
                          <Textarea
                            value={draft.description}
                            onChange={(event) =>
                              updateDraft(item.id, {
                                description: event.target.value,
                              })
                            }
                            className="min-h-[96px] border-white/10 bg-[#0B132B] text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-zinc-300">Due date</Label>
                          <Input
                            type="date"
                            value={draft.dueDate}
                            onChange={(event) =>
                              updateDraft(item.id, { dueDate: event.target.value })
                            }
                            className="border-white/10 bg-[#0B132B] text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {item.sourceExcerpt ? (
                  <blockquote className="mt-4 rounded-xl border border-white/5 bg-[#0B132B]/70 px-4 py-3 text-sm italic text-zinc-300">
                    “{item.sourceExcerpt}”
                  </blockquote>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 pt-4">
                  <Link
                    href={meetingHref}
                    className="inline-flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
                  >
                    From: {item.meetingTitle}
                    {item.meetingDate ? ` · ${formatDueDate(item.meetingDate)}` : ''}
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>

                  <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
                    <div className="min-w-[220px] space-y-1">
                      <Label className="text-xs text-zinc-500">Assignee</Label>
                      <Select
                        value={draft.assigneeId || '__none__'}
                        onValueChange={(value) =>
                          updateDraft(item.id, {
                            assigneeId: value === '__none__' ? '' : value,
                          })
                        }
                      >
                        <SelectTrigger className="border-white/10 bg-[#0B132B] text-white">
                          <SelectValue placeholder="Choose assignee" />
                        </SelectTrigger>
                        <SelectContent className="border-white/10 bg-[#0F1B35] text-white">
                          <SelectItem value="__none__">Unassigned</SelectItem>
                          {members.map((member) => (
                            <SelectItem key={member.userId} value={member.userId}>
                              {member.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/5"
                        disabled={isPending || bulkPending}
                        onClick={() => rejectItem(item)}
                      >
                        <X className="mr-1 h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/5"
                        disabled={isPending || bulkPending}
                        onClick={() => toggleEditing(item.id, item)}
                      >
                        <Pencil className="mr-1 h-4 w-4" />
                        {isEditing ? 'Cancel edit' : 'Edit & approve'}
                      </Button>
                      {isEditing ? (
                        <Button
                          type="button"
                          className="keel-gradient-btn text-white"
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
                      ) : (
                        <Button
                          type="button"
                          className="keel-gradient-btn text-white"
                          disabled={isPending || bulkPending}
                          onClick={() => approveItem(item, false)}
                        >
                          {isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Approving…
                            </>
                          ) : (
                            'Approve'
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
