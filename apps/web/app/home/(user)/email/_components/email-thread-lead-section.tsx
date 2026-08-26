'use client';

import { useEffect, useRef, useTransition } from 'react';

import Link from 'next/link';

import { Kanban, Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import pathsConfig from '~/config/paths.config';

import { emailApiFetch } from '../_lib/email-api';
import type {
  EmailThreadPipelineLeadSuggestion,
  EmailThreadSummary,
  EmailWorkspaceOption,
} from '../_lib/types';

const panelClass =
  'rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/60';

type Props = {
  threadId: string;
  mailboxKind: 'business' | 'personal';
  accountSlug?: string | null;
  pipelineLeadSuggestion: EmailThreadPipelineLeadSuggestion | null;
  pipelineLeadConfidence: number | null;
  pipelineDealId: string | null;
  workspaces: EmailWorkspaceOption[];
  onUpdated: (patch: Partial<EmailThreadSummary>) => void;
};

function suggestionHeadline(suggestion: EmailThreadPipelineLeadSuggestion) {
  const parts = [suggestion.contactName, suggestion.companyName].filter(
    Boolean,
  );
  return parts.join(' · ');
}

export function EmailThreadLeadSection({
  threadId,
  mailboxKind,
  accountSlug = null,
  pipelineLeadSuggestion,
  pipelineLeadConfidence,
  pipelineDealId,
  workspaces,
  onUpdated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const autoTriedRef = useRef<string | null>(null);

  const workspaceSlug =
    accountSlug ??
    workspaces.find((w) => w.id === pipelineLeadSuggestion?.accountId)?.slug ??
    null;

  const pipelineHref = workspaceSlug
    ? pathsConfig.app.accountPipeline.replace('[account]', workspaceSlug)
    : null;

  function runSuggest(silent = false) {
    startTransition(async () => {
      try {
        const data = await emailApiFetch<{ thread: EmailThreadSummary }>(
          `/api/gmail/threads/${threadId}/suggest-pipeline-lead`,
          { method: 'POST' },
        );
        onUpdated(data.thread);
        if (!silent) {
          if (data.thread.pipeline_lead_suggestion) {
            toast.success('Pipeline lead suggestion ready');
          } else {
            toast.message('No new lead detected for this thread');
          }
        }
      } catch (error) {
        if (!silent) {
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not suggest pipeline lead',
          );
        }
      }
    });
  }

  useEffect(() => {
    if (mailboxKind !== 'business') {
      return;
    }

    if (pipelineDealId || pipelineLeadSuggestion) {
      return;
    }

    if (autoTriedRef.current === threadId) {
      return;
    }

    autoTriedRef.current = threadId;
    runSuggest(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per thread open
  }, [mailboxKind, pipelineDealId, pipelineLeadSuggestion, threadId]);

  function acceptSuggestion() {
    startTransition(async () => {
      try {
        const data = await emailApiFetch<{
          dealId: string;
          accountSlug: string | null;
          thread: EmailThreadSummary;
        }>(`/api/gmail/threads/${threadId}/pipeline-lead`, {
          method: 'POST',
          body: JSON.stringify({ accountSlug: workspaceSlug ?? undefined }),
        });

        onUpdated(data.thread);
        toast.success('Pipeline lead created');

        if (data.accountSlug) {
          const href = pathsConfig.app.accountPipeline.replace(
            '[account]',
            data.accountSlug,
          );
          window.open(href, '_blank', 'noopener,noreferrer');
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not create pipeline lead',
        );
      }
    });
  }

  if (mailboxKind === 'personal') {
    return null;
  }

  if (pipelineDealId && pipelineHref) {
    return (
      <div className={cn(panelClass, 'px-3 py-3')}>
        <div className="flex items-start gap-2">
          <Kanban className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Pipeline lead created
            </p>
            <Link
              href={pipelineHref}
              className="mt-1 inline-flex text-xs text-[var(--ozer-accent)] hover:underline"
            >
              Open pipeline
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(panelClass, 'px-3 py-3')}>
      <div className="flex items-start gap-2">
        <Kanban className="mt-0.5 h-4 w-4 shrink-0 text-[var(--ozer-accent)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Pipeline lead
          </p>

          {pipelineLeadSuggestion ? (
            <div className="rounded-lg border border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)] px-3 py-2">
              <p className="text-xs font-medium text-[var(--workspace-shell-text)]">
                Suggested: {suggestionHeadline(pipelineLeadSuggestion)}
                {typeof pipelineLeadConfidence === 'number'
                  ? ` (${Math.round(pipelineLeadConfidence * 100)}%)`
                  : ''}
              </p>
              {pipelineLeadSuggestion.description ? (
                <p className="mt-1 text-xs text-[var(--workspace-shell-text-muted)]">
                  {pipelineLeadSuggestion.description}
                </p>
              ) : null}
              <div className="mt-2 flex justify-end">
                <Button
                  type="button"
                  size="sm"
                  className="h-8 bg-[var(--ozer-accent)] text-[var(--ozer-white)] hover:bg-[var(--ozer-accent-hover)]"
                  disabled={pending}
                  onClick={acceptSuggestion}
                >
                  {pending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Create lead
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {pending
                ? 'Checking whether this looks like a new enquiry…'
                : 'No new lead detected. Use the thread menu to re-scan if this is an enquiry.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
