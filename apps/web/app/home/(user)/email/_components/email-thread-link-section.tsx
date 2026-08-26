'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { ChevronDown, Loader2, Sparkles, UserRound } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { TaskAssignmentCombobox } from '~/home/(user)/_components/dashboard/task-assignment-combobox';
import {
  type TaskAssignmentOption,
  loadTaskAssignmentOptionsForWorkspace,
} from '~/home/(user)/_lib/actions/task-actions';
import { PlannerClientAvatar } from '~/home/(user)/planner/_components/planner-client-pill';

import { emailApiFetch } from '../_lib/email-api';
import type {
  EmailThreadLink,
  EmailThreadLinkSuggestion,
  EmailWorkspaceOption,
} from '../_lib/types';

type Props = {
  threadId: string;
  link: EmailThreadLink;
  linkSuggestion?: EmailThreadLinkSuggestion | null;
  linkConfidence?: number | null;
  workspaces: EmailWorkspaceOption[];
  preferredAccountId?: string | null;
  onUpdated: (link: EmailThreadLink) => void;
  onSuggestionUpdated?: (suggestion: EmailThreadLinkSuggestion | null) => void;
};

function linkLabel(link: EmailThreadLink): string | null {
  if (link.projectName) {
    return link.projectName;
  }

  if (link.clientName) {
    return link.clientName;
  }

  return null;
}

function suggestionLabel(suggestion: EmailThreadLinkSuggestion): string | null {
  if (suggestion.projectName) {
    return suggestion.projectName;
  }

  if (suggestion.clientName) {
    return suggestion.clientName;
  }

  return null;
}

function defaultWorkspaceId(
  link: EmailThreadLink,
  workspaces: EmailWorkspaceOption[],
  preferredAccountId?: string | null,
): string {
  if (link.accountId) {
    return link.accountId;
  }

  if (
    preferredAccountId &&
    workspaces.some((workspace) => workspace.id === preferredAccountId)
  ) {
    return preferredAccountId;
  }

  return workspaces[0]?.id ?? '';
}

export function EmailThreadLinkSection({
  threadId,
  link,
  linkSuggestion = null,
  linkConfidence = null,
  workspaces,
  preferredAccountId = null,
  onUpdated,
  onSuggestionUpdated,
}: Props) {
  const [workspaceId, setWorkspaceId] = useState(() =>
    defaultWorkspaceId(link, workspaces, preferredAccountId),
  );
  const [assignTo, setAssignTo] = useState(
    link.projectId ? link.projectId : link.clientId ? link.clientId : 'none',
  );
  const [options, setOptions] = useState<TaskAssignmentOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [changeWorkspace, setChangeWorkspace] = useState(false);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const autoSuggestTriedRef = useRef<string | null>(null);

  const currentLabel = useMemo(() => linkLabel(link), [link]);
  const suggestedLabel = useMemo(
    () => (linkSuggestion ? suggestionLabel(linkSuggestion) : null),
    [linkSuggestion],
  );
  const workspaceLabel =
    workspaces.find((workspace) => workspace.id === workspaceId)?.label ??
    'Workspace';

  useEffect(() => {
    setWorkspaceId(defaultWorkspaceId(link, workspaces, preferredAccountId));
    setAssignTo(
      link.projectId ? link.projectId : link.clientId ? link.clientId : 'none',
    );
    setChangeWorkspace(false);
  }, [
    link.accountId,
    link.clientId,
    link.projectId,
    preferredAccountId,
    threadId,
    workspaces,
  ]);

  useEffect(() => {
    if (!workspaceId) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setOptionsLoading(true);

    void loadTaskAssignmentOptionsForWorkspace(workspaceId)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setOptions(data);
        setOptionsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setOptions([]);
          setOptionsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function saveLink(
    clear = false,
    suggestion?: EmailThreadLinkSuggestion | null,
    nextAssignTo = assignTo,
  ) {
    startTransition(async () => {
      try {
        const selected = options.find((option) => option.id === nextAssignTo);
        const data = await emailApiFetch<{ thread: { link: EmailThreadLink } }>(
          `/api/gmail/threads/${threadId}/link`,
          {
            method: 'PATCH',
            body: JSON.stringify(
              clear
                ? {
                    accountId: null,
                    clientId: null,
                    projectId: null,
                  }
                : suggestion
                  ? {
                      accountId: suggestion.accountId,
                      clientId: suggestion.clientId,
                      projectId: suggestion.projectId,
                    }
                  : {
                      accountId: workspaceId || null,
                      clientId:
                        selected?.type === 'client' ? selected.id : null,
                      projectId:
                        selected?.type === 'project' ? selected.id : null,
                    },
            ),
          },
        );

        onUpdated(data.thread.link);
        if (suggestion) {
          onSuggestionUpdated?.(null);
        }
        if (clear) {
          setAssignTo('none');
        }
        toast.success(clear ? 'Link removed' : 'Thread linked');
        setOpen(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update link',
        );
      }
    });
  }

  function handleAssignToChange(value: string) {
    setAssignTo(value);
    if (value === 'none') {
      if (link.linked) {
        saveLink(true, null, value);
      }
      return;
    }

    saveLink(false, null, value);
  }

  function runSuggestLink(silent = false) {
    startTransition(async () => {
      try {
        const data = await emailApiFetch<{
          thread: {
            link_suggestion: EmailThreadLinkSuggestion | null;
            link_confidence: number | null;
            link: EmailThreadLink;
          };
        }>(`/api/gmail/threads/${threadId}/suggest-link`, {
          method: 'POST',
        });
        onSuggestionUpdated?.(data.thread.link_suggestion);
        if (data.thread.link?.linked) {
          onUpdated(data.thread.link);
          if (!silent) {
            toast.success('Thread auto-linked');
          }
          setOpen(false);
        } else if (data.thread.link_suggestion) {
          if (!silent) {
            toast.success('Link suggestion ready');
          }
        } else if (!silent) {
          toast.message('No confident link suggestion for this thread');
        }
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof Error ? error.message : 'Could not suggest link',
          );
        }
      }
    });
  }

  useEffect(() => {
    if (link.linked || linkSuggestion) {
      return;
    }

    if (autoSuggestTriedRef.current === threadId) {
      return;
    }

    autoSuggestTriedRef.current = threadId;
    runSuggestLink(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per thread open
  }, [link.linked, linkSuggestion, threadId]);

  const triggerLabel = currentLabel ?? 'Not assigned';
  const showAssigned = Boolean(link.linked && currentLabel);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          className={cn(
            'mt-0.5 h-8 max-w-[12rem] shrink-0 gap-1.5 border-[color:var(--workspace-shell-border)] bg-transparent font-normal',
            showAssigned
              ? 'text-[var(--workspace-shell-text)]'
              : 'text-[var(--workspace-shell-text-muted)]',
          )}
        >
          {showAssigned ? (
            <PlannerClientAvatar
              name={triggerLabel}
              pictureUrl={link.clientPictureUrl}
              color={link.linkColor}
              className="h-4 w-4"
            />
          ) : (
            <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]">
              <UserRound className="h-2.5 w-2.5" />
            </span>
          )}
          <span className="truncate">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[min(22rem,calc(100vw-2rem))] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3"
      >
        <div className="space-y-3">
          {!link.linked && suggestedLabel && linkSuggestion ? (
            <div className="rounded-lg border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-3 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex min-w-0 flex-1 items-center gap-1.5 text-xs font-medium text-[var(--ozer-accent)]">
                  <Sparkles className="h-3 w-3 shrink-0" />
                  <span className="truncate">
                    Suggested: {suggestedLabel}
                    {typeof linkConfidence === 'number'
                      ? ` · ${Math.round(linkConfidence * 100)}%`
                      : ''}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 bg-[var(--ozer-accent)] px-2.5 text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                  disabled={pending}
                  onClick={() => saveLink(false, linkSuggestion)}
                >
                  Accept
                </Button>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
                Client or project
              </p>
              {workspaces.length > 1 ? (
                <button
                  type="button"
                  className="text-[11px] text-[var(--ozer-accent)] hover:underline"
                  onClick={() => setChangeWorkspace((value) => !value)}
                >
                  {changeWorkspace
                    ? 'Hide workspace'
                    : `Change workspace · ${workspaceLabel}`}
                </button>
              ) : (
                <span className="text-[11px] text-[var(--workspace-shell-text-muted)]">
                  {workspaceLabel}
                </span>
              )}
            </div>

            {changeWorkspace && workspaces.length > 1 ? (
              <Select
                value={workspaceId || 'none'}
                onValueChange={(value) => {
                  setWorkspaceId(value === 'none' ? '' : value);
                  setAssignTo('none');
                }}
              >
                <SelectTrigger className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)]">
                  <SelectValue placeholder="Select workspace" />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}

            <TaskAssignmentCombobox
              embedded
              value={assignTo}
              onValueChange={handleAssignToChange}
              options={options}
              isWorkspaceMode
              noneLabel="Not assigned"
              placeholder={
                optionsLoading ? 'Loading…' : 'Select client or project'
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-8 px-2 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
              disabled={pending}
              onClick={() => runSuggestLink(false)}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="mr-2 h-4 w-4" />
              )}
              Suggest link
            </Button>
            {link.linked ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-8 px-2 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                disabled={pending}
                onClick={() => saveLink(true)}
              >
                Remove link
              </Button>
            ) : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
