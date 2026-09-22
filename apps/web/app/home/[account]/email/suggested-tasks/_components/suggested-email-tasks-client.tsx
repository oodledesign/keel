'use client';

import { useMemo, useState } from 'react';

import { Ban, Check, ChevronDown, ListTodo, Mail, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { toast } from '@kit/ui/sonner';

import { HapticLink } from '~/components/haptic-link';
import pathsConfig from '~/config/paths.config';
import {
  acceptSuggestedEmailTaskAction,
  dismissSuggestedEmailTaskAction,
  ignoreSuggestedEmailSenderAction,
} from '~/lib/email-assistant/email-assistant.actions';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';
import type { SuggestedEmailTaskItem } from '~/lib/email-assistant/suggested-email-tasks.loader';
import { RetainerMatchReviewCard } from '~/lib/retainers/retainer-match-review-card';
import type { RetainerServiceRecord } from '~/lib/retainers/types';
import { commitOptimisticUpdate } from '~/lib/tasks/commit-optimistic-update';
import { omitHiddenItems } from '~/lib/tasks/session-task-status';
import { formatDurationMinutes } from '~/lib/tasks/task-duration';

type Props = {
  accountSlug?: string;
  accountId?: string;
  initialItems: SuggestedEmailTaskItem[];
  totalCount: number;
  retainerServices?: RetainerServiceRecord[];
};

export function SuggestedEmailTasksClient({
  accountSlug,
  accountId,
  initialItems,
  totalCount,
  retainerServices = [],
}: Props) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set());
  const items = useMemo(
    () => omitHiddenItems(initialItems, hiddenIds),
    [hiddenIds, initialItems],
  );

  const inboxHref = accountSlug
    ? pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)
    : pathsConfig.app.personalEmailAssistant;
  const remaining = Math.max(
    0,
    totalCount - Math.max(0, initialItems.length - items.length),
  );

  function hide(ids: string[]) {
    if (ids.length === 0) return;
    commitOptimisticUpdate(() => {
      setHiddenIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    });
  }

  function show(ids: string[]) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      let changed = false;
      for (const id of ids) {
        if (next.delete(id)) changed = true;
      }
      return changed ? next : prev;
    });
  }

  function runAction(
    actionItemId: string,
    kind: 'accept' | 'dismiss' | 'ignore-sender' | 'ignore-domain',
  ) {
    const current = initialItems.find((item) => item.id === actionItemId);
    const hiddenNow =
      kind === 'ignore-domain'
        ? initialItems
            .filter((item) => {
              if (hiddenIds.has(item.id)) return false;
              const domain = (current?.fromDomain ?? '').toLowerCase();
              if (item.id === actionItemId) return true;
              if (!domain) return false;
              return (item.fromDomain ?? '').toLowerCase() === domain;
            })
            .map((item) => item.id)
        : kind === 'ignore-sender'
          ? initialItems
              .filter((item) => {
                if (hiddenIds.has(item.id)) return false;
                const email = (current?.fromEmail ?? '').toLowerCase();
                if (item.id === actionItemId) return true;
                if (!email) return false;
                return (item.fromEmail ?? '').toLowerCase() === email;
              })
              .map((item) => item.id)
          : [actionItemId];

    hide(hiddenNow);
    void (async () => {
      try {
        if (kind === 'accept') {
          await acceptSuggestedEmailTaskAction({
            actionItemId,
            accountId: accountId ?? undefined,
            accountSlug: accountSlug ?? undefined,
          });
          toast.success('Task added to planner');
        } else if (kind === 'dismiss') {
          await dismissSuggestedEmailTaskAction({
            actionItemId,
            accountId: accountId ?? undefined,
            accountSlug: accountSlug ?? undefined,
          });
          toast.success('Suggestion dismissed');
        } else {
          const scope = kind === 'ignore-domain' ? 'domain' : 'sender';
          const result = await ignoreSuggestedEmailSenderAction({
            actionItemId,
            accountId: accountId ?? undefined,
            accountSlug: accountSlug ?? undefined,
            scope,
          });

          if (scope === 'domain') {
            const domain =
              result.domain ?? result.value ?? current?.fromDomain ?? '';
            toast.success(
              domain
                ? `Ignored @${domain} and removed matching pending tasks`
                : 'Domain ignored and pending tasks removed',
            );
            const ignoredDomain = domain.toLowerCase();
            if (ignoredDomain) {
              hide(
                initialItems
                  .filter(
                    (item) =>
                      (item.fromDomain ?? '').toLowerCase() === ignoredDomain,
                  )
                  .map((item) => item.id),
              );
            }
          } else {
            const sender =
              result.sender ??
              result.value ??
              current?.fromEmail ??
              current?.fromAddress;
            toast.success(
              sender
                ? `Ignored ${sender} and removed their pending tasks`
                : 'Sender ignored and pending tasks removed',
            );
            const ignoredEmail = (
              result.sender ??
              result.value ??
              current?.fromEmail ??
              ''
            ).toLowerCase();
            if (ignoredEmail) {
              hide(
                initialItems
                  .filter(
                    (item) =>
                      (item.fromEmail ?? '').toLowerCase() === ignoredEmail,
                  )
                  .map((item) => item.id),
              );
            }
          }
        }
      } catch (error) {
        show(hiddenNow);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not update suggestion',
        );
      }
    })();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-6 lg:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          {remaining === 0
            ? 'No email tasks waiting for confirmation.'
            : remaining === 1
              ? '1 suggested task — accept to add it to your planner, or dismiss.'
              : `${remaining} suggested tasks — accept to add them to your planner, or dismiss.`}
        </p>
        <HapticLink
          href={inboxHref}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--ozer-accent)]"
        >
          <Mail className="h-3.5 w-3.5" />
          Back to inbox
        </HapticLink>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-6 py-12 text-center">
          <ListTodo className="h-8 w-8 text-[var(--ozer-accent)]" />
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            All caught up
          </p>
          <p className="max-w-sm text-sm text-[var(--workspace-shell-text-muted)]">
            When emails need a reply, clear requests are suggested here for you
            to confirm before they become planner tasks.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[color:var(--workspace-shell-border)] overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          {items.map((item) => {
            const sentLabel = formatEmailDateTime(item.emailSentAt);

            return (
              <li
                key={item.id}
                className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  {item.clientName ? (
                    <ProfileAvatar
                      displayName={item.clientName}
                      pictureUrl={item.clientPictureUrl}
                      className="mt-0.5 h-9 w-9 shrink-0"
                    />
                  ) : (
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--ozer-accent)]">
                      <Mail className="h-4 w-4" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                      {item.title}
                    </p>
                    {item.detail ? (
                      <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                        {item.detail}
                      </p>
                    ) : null}
                    <p className="mt-1.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {[
                        item.clientName,
                        item.threadSubject,
                        item.suggestedDueDate
                          ? `due ${item.suggestedDueDate}`
                          : null,
                        formatDurationMinutes(item.suggestedDurationMinutes),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                    <p className="mt-1 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                      {item.fromEmail || item.fromAddress
                        ? `From ${item.fromEmail ?? item.fromAddress}`
                        : 'From unknown sender'}
                      {sentLabel ? ` · sent ${sentLabel}` : ''}
                    </p>
                    {item.retainerMatch ? (
                      <RetainerMatchReviewCard
                        suggestion={item.retainerMatch}
                        services={retainerServices}
                        accountSlug={accountSlug}
                        onResolved={() => hide([item.id])}
                      />
                    ) : null}
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {item.retainerMatch ? null : (
                    <button
                      type="button"
                      onClick={() => runAction(item.id, 'accept')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] px-3 text-xs font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)]"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Accept
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runAction(item.id, 'dismiss')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)]"
                  >
                    <X className="h-3.5 w-3.5" />
                    Dismiss
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!item.fromEmail}
                        className="h-9 border-[color:var(--workspace-shell-border)] bg-transparent text-xs font-medium text-[var(--workspace-shell-text-muted)] hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)]"
                      >
                        <Ban className="mr-1.5 h-3.5 w-3.5" />
                        Ignore
                        <ChevronDown className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-64">
                      <DropdownMenuItem
                        disabled={!item.fromEmail}
                        onSelect={() => runAction(item.id, 'ignore-sender')}
                      >
                        Ignore sender
                        {item.fromEmail ? ` (${item.fromEmail})` : ''}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!item.fromDomain}
                        onSelect={() => runAction(item.id, 'ignore-domain')}
                      >
                        Ignore domain
                        {item.fromDomain ? ` (@${item.fromDomain})` : ''}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
