'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandList,
} from '@kit/ui/command';
import { toast } from '@kit/ui/sonner';

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
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Ask Keel to create a task, run PageSpeed…"
        value={query}
        onValueChange={setQuery}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey && !showPreview) {
            event.preventDefault();
            runPlan();
          }
        }}
      />
      <CommandList className="max-h-[min(70vh,480px)] p-3">
        <CommandEmpty className="py-8 text-white/60">
          {planning ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking…
            </span>
          ) : (
            'Describe what you want Keel to do, then press Enter.'
          )}
        </CommandEmpty>

        {!showPreview && !planning ? (
          <div className="space-y-3 px-1 pb-2">
            <p className="text-xs text-white/45">
              Examples: &quot;Write a task in greentrees to get an electrician for
              the bungalow this week&quot; · &quot;Run a pagespeed scan for
              arcanum&quot;
            </p>
            <Button
              type="button"
              className="w-full bg-[var(--keel-teal)] text-white hover:bg-[#238b7f]"
              disabled={!query.trim() || planning}
              onClick={runPlan}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Plan action
            </Button>
          </div>
        ) : null}

        {planning ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-white/70">
            <Loader2 className="h-4 w-4 animate-spin" />
            Resolving workspaces and preparing preview…
          </div>
        ) : null}

        {assistantMessage && !planning ? (
          <p className="mb-3 px-1 text-sm text-white/80">{assistantMessage}</p>
        ) : null}

        {resultLink ? (
          <div className="mb-3 rounded-lg border border-[var(--keel-teal)]/30 bg-[var(--keel-teal)]/10 px-3 py-2">
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
            <p className="px-1 text-xs text-white/50">Choose an action:</p>
            {proposedActions.map((action) => (
              <button
                key={action.actionToken}
                type="button"
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-white hover:bg-white/[0.06]"
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
    </CommandDialog>
  );
}
