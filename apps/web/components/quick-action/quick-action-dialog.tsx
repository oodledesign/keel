'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  Command as CommandRoot,
  CommandEmpty,
  CommandList,
  CommandRawInput,
} from '@kit/ui/command';
import { Dialog, DialogContent } from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import { Loader2, Sparkles, X } from 'lucide-react';

import { Button } from '@kit/ui/button';

import type {
  ProposedQuickAction,
  QuickActionExecuteResponse,
  QuickActionPlanResponse,
} from '~/lib/quick-action/types';

import { ActionPreviewCard } from './action-preview-card';

type QuickActionDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pageContext: {
    accountId?: string;
    accountSlug?: string;
  };
};

const QUICK_ACTION_SHELL_CLASS =
  'max-w-xl gap-0 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[#0B132B] p-0 text-white shadow-[0_16px_48px_rgba(0,0,0,0.45)] outline-none ring-0 focus:outline-none focus-visible:outline-none sm:rounded-[1.25rem]';

const QUICK_ACTION_OVERLAY_CLASS = 'bg-[#060a12]/50 backdrop-blur-[2px]';

export function QuickActionDialog(props: QuickActionDialogProps) {
  const { open, onOpenChange, pageContext } = props;
  const [query, setQuery] = useState('');
  const [planning, startPlanning] = useTransition();
  const [executing, startExecuting] = useTransition();
  const [assistantMessage, setAssistantMessage] = useState<string | null>(null);
  const [proposedActions, setProposedActions] = useState<ProposedQuickAction[]>(
    [],
  );
  const [selectedAction, setSelectedAction] = useState<ProposedQuickAction | null>(
    null,
  );
  const [resultLink, setResultLink] = useState<string | null>(null);

  const reset = useCallback(() => {
    setQuery('');
    setAssistantMessage(null);
    setProposedActions([]);
    setSelectedAction(null);
    setResultLink(null);
  }, []);

  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const runPlan = () => {
    const message = query.trim();
    if (!message || planning) return;

    startPlanning(async () => {
      setAssistantMessage(null);
      setProposedActions([]);
      setSelectedAction(null);
      setResultLink(null);

      try {
        const res = await fetch('/api/quick-action/plan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message, context: pageContext }),
        });

        const body = (await res.json()) as QuickActionPlanResponse & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(body.error ?? 'Failed to plan action');
        }

        setAssistantMessage(body.assistantMessage);
        setProposedActions(body.proposedActions ?? []);
        if (body.proposedActions?.length === 1) {
          setSelectedAction(body.proposedActions[0]!);
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not plan quick action',
        );
      }
    });
  };

  const confirmAction = (action: ProposedQuickAction) => {
    startExecuting(async () => {
      try {
        const res = await fetch('/api/quick-action/execute', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ actionToken: action.actionToken }),
        });

        const body = (await res.json()) as QuickActionExecuteResponse & {
          error?: string;
        };

        if (!res.ok) {
          throw new Error(body.error ?? 'Failed to execute action');
        }

        toast.success(body.message);
        setResultLink(body.link);
        setSelectedAction(null);
        setProposedActions([]);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not execute action',
        );
      }
    });
  };

  const showPreview = selectedAction !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        overlayClassName={QUICK_ACTION_OVERLAY_CLASS}
        className={QUICK_ACTION_SHELL_CLASS}
        onCloseAutoFocus={(event) => event.preventDefault()}
      >
        <CommandRoot
          shouldFilter={false}
          className="flex flex-col overflow-hidden bg-transparent text-white"
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Sparkles className="h-5 w-5 shrink-0 text-[var(--keel-teal)]" />
              <p className="text-base font-semibold text-white">Quick action</p>
            </div>
            <button
              type="button"
              aria-label="Close quick action"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-300 outline-none transition-colors hover:bg-white/8 hover:text-white focus:outline-none focus-visible:outline-none"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="flex items-center gap-3 border-b border-white/10 px-4 py-3"
            cmdk-input-wrapper=""
          >
            <Sparkles className="h-4 w-4 shrink-0 text-[var(--keel-teal)]/80" />
            <CommandRawInput
              placeholder="Ask Keel to create a task, run PageSpeed…"
              value={query}
              onValueChange={setQuery}
              className={cn(
                'flex h-10 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-500',
                'ring-0 focus:outline-none focus-visible:outline-none',
              )}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !showPreview) {
                  event.preventDefault();
                  runPlan();
                }
              }}
            />
            <kbd className="hidden shrink-0 rounded border border-white/12 bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-white/55 sm:inline">
              ↵
            </kbd>
          </div>

          <CommandList className="max-h-[min(70vh,480px)] px-4 py-4">
            <CommandEmpty className="py-6 text-left text-sm text-zinc-400">
              {planning ? (
                <span className="inline-flex items-center gap-2 text-zinc-300">
                  <Loader2 className="h-4 w-4 animate-spin text-[var(--keel-teal)]" />
                  Thinking…
                </span>
              ) : (
                'Describe what you want Keel to do, then press Enter.'
              )}
            </CommandEmpty>

            {!showPreview && !planning ? (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-zinc-400">
                  Examples: &quot;Write a task in greentrees to get an electrician
                  for the bungalow this week&quot; · &quot;Run a pagespeed scan for
                  arcanum&quot;
                </p>
                <Button
                  type="button"
                  className="h-11 w-full rounded-xl border-0 bg-[var(--keel-teal)] text-[15px] font-semibold text-white shadow-none hover:bg-[#238b7f] focus-visible:ring-0"
                  disabled={!query.trim() || planning}
                  onClick={runPlan}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  Plan action
                </Button>
              </div>
            ) : null}

            {planning ? (
              <div className="flex items-center gap-2 py-8 text-sm text-zinc-300">
                <Loader2 className="h-4 w-4 animate-spin text-[var(--keel-teal)]" />
                Resolving workspaces and preparing preview…
              </div>
            ) : null}

            {assistantMessage && !planning ? (
              <p className="mb-4 text-sm leading-relaxed text-zinc-200">
                {assistantMessage}
              </p>
            ) : null}

            {resultLink ? (
              <div className="mb-4 rounded-xl border border-[var(--keel-teal)]/25 bg-[var(--keel-teal)]/10 px-4 py-3">
                <Link
                  href={resultLink}
                  className="text-sm font-medium text-[var(--keel-teal)] underline-offset-2 hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  Open result →
                </Link>
              </div>
            ) : null}

            {showPreview && selectedAction ? (
              <ActionPreviewCard
                action={selectedAction}
                confirming={executing}
                onCancel={() => setSelectedAction(null)}
                onConfirm={() => confirmAction(selectedAction)}
              />
            ) : null}

            {!showPreview && proposedActions.length > 1 && !planning ? (
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Choose an action
                </p>
                {proposedActions.map((action) => (
                  <button
                    key={action.actionToken}
                    type="button"
                    className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-zinc-200 outline-none transition-colors hover:bg-white/[0.06] focus:outline-none focus-visible:outline-none"
                    onClick={() => setSelectedAction(action)}
                  >
                    {action.preview.type === 'create_task'
                      ? `Create task: ${action.preview.title}`
                      : `PageSpeed: ${action.preview.projectName}`}
                  </button>
                ))}
              </div>
            ) : null}
          </CommandList>
        </CommandRoot>
      </DialogContent>
    </Dialog>
  );
}
