'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Ban, Check, ChevronDown, ListTodo, Mail, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
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

type Props = {
  accountSlug?: string;
  accountId?: string;
  initialItems: SuggestedEmailTaskItem[];
  totalCount: number;
};

export function SuggestedEmailTasksClient({
  accountSlug,
  accountId,
  initialItems,
  totalCount,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pendingIds, setPendingIds] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  const inboxHref = accountSlug
    ? pathsConfig.app.accountEmailAssistant.replace('[account]', accountSlug)
    : pathsConfig.app.personalEmailAssistant;
  const remaining = Math.max(
    0,
    totalCount - Math.max(0, initialItems.length - items.length),
  );

  function runAction(
    actionItemId: string,
    kind: 'accept' | 'dismiss' | 'ignore-sender' | 'ignore-domain',
  ) {
    setPendingIds((prev) => new Set(prev).add(actionItemId));
    startTransition(async () => {
      try {
        if (kind === 'accept') {
          await acceptSuggestedEmailTaskAction({
            actionItemId,
            accountId: accountId ?? undefined,
            accountSlug: accountSlug ?? undefined,
          });
          toast.success('Task added to planner');
          setItems((prev) => prev.filter((item) => item.id !== actionItemId));
        } else if (kind === 'dismiss') {
          await dismissSuggestedEmailTaskAction({
            actionItemId,
            accountId: accountId ?? undefined,
            accountSlug: accountSlug ?? undefined,
          });
          toast.success('Suggestion dismissed');
          setItems((prev) => prev.filter((item) => item.id !== actionItemId));
        } else {
          const current = items.find((item) => item.id === actionItemId);
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
            setItems((prev) =>
              prev.filter((item) => {
                if (item.id === actionItemId) {
                  return false;
                }

                if (!ignoredDomain) {
                  return true;
                }

                return (item.fromDomain ?? '').toLowerCase() !== ignoredDomain;
              }),
            );
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
            setItems((prev) =>
              prev.filter((item) => {
                if (item.id === actionItemId) {
                  return false;
                }

                if (!ignoredEmail) {
                  return true;
                }

                return (item.fromEmail ?? '').toLowerCase() !== ignoredEmail;
              }),
            );
          }
        }
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
            const busy = isPending && pendingIds.has(item.id);
            const sentLabel = formatEmailDateTime(item.emailSentAt);

            return (
              <li
                key={item.id}
                className="flex min-w-0 flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
              >
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
                    {item.threadSubject}
                    {item.suggestedDueDate
                      ? ` · due ${item.suggestedDueDate}`
                      : ''}
                  </p>
                  <p className="mt-1 truncate text-xs text-[var(--workspace-shell-text-muted)]">
                    {item.fromEmail || item.fromAddress
                      ? `From ${item.fromEmail ?? item.fromAddress}`
                      : 'From unknown sender'}
                    {sentLabel ? ` · sent ${sentLabel}` : ''}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(item.id, 'accept')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--ozer-accent)]/35 bg-[var(--ozer-accent-subtle)] px-3 text-xs font-medium text-[var(--ozer-accent)] transition-colors hover:border-[var(--ozer-accent)] disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => runAction(item.id, 'dismiss')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 text-xs font-medium text-[var(--workspace-shell-text-muted)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:text-[var(--ozer-accent)] disabled:opacity-50"
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
                        disabled={busy || !item.fromEmail}
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
