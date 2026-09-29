'use client';

import { type KeyboardEvent, useState, useTransition } from 'react';

import { Copy, Loader2, RefreshCw, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import { isInsufficientAiCreditsMessage } from '~/lib/ai/ai-credits-exhausted';
import {
  DISPOSALS_AI_FORMATS,
  DISPOSALS_AI_FORMAT_LABELS,
  DISPOSALS_AI_PRESETS,
  DISPOSALS_AI_PROMPT_MAX_LENGTH,
  type DisposalsAiFormat,
} from '~/lib/commercial/disposals-ai-presets';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  type DisposalsAiPeriodSummary,
  type DisposalsAiResult,
  askDisposalsAiAction,
} from '../_lib/server/disposals-ai-actions';

type AiRequest = { prompt: string; format: DisposalsAiFormat };

const chipClass =
  'rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-3 py-1.5 text-xs font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-panel-hover)] disabled:opacity-50';

function PeriodCounts({ summary }: { summary: DisposalsAiPeriodSummary }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-[var(--workspace-shell-text)]">
        {summary.label}
      </p>
      <p className="text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
        {summary.counts
          .map((item) => `${item.label}: ${item.count}`)
          .join(' · ')}
      </p>
    </div>
  );
}

export function DisposalsAiDialog({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [format, setFormat] = useState<DisposalsAiFormat>('answer');
  const [result, setResult] = useState<DisposalsAiResult | null>(null);
  const [text, setText] = useState('');
  const [lastRequest, setLastRequest] = useState<AiRequest | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (request: AiRequest) => {
    const trimmed = request.prompt.trim();
    if (trimmed.length < 3 || pending) return;

    setError(null);
    setLastRequest({ ...request, prompt: trimmed });
    startTransition(async () => {
      try {
        const next = await askDisposalsAiAction({
          accountId,
          prompt: trimmed,
          format: request.format,
        });
        setResult(next);
        setText(next.text);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not generate a response';
        setError(
          isInsufficientAiCreditsMessage(message)
            ? 'Not enough AI credits for this request. Top up credits and try again.'
            : message,
        );
      }
    });
  };

  const onPromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      run({ prompt, format });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Could not copy. Select the text and copy it manually.');
    }
  };

  const isDraft = lastRequest?.format !== 'answer';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-test="disposals-ask-ai"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 text-sm font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
      >
        <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
        Ask AI
      </button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setError(null);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[var(--workspace-shell-text)]">
              <Sparkles className="h-4 w-4 text-[var(--ozer-accent)]" />
              Ask AI about your disposals
            </DialogTitle>
            <DialogDescription className="text-[var(--workspace-shell-text-muted)]">
              Draft LinkedIn or blog posts from disposals activity, or ask
              questions about it. Only public-safe disposal details are used,
              never WIP, fees, clients or internal notes. Uses 3 AI credits per
              request.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {DISPOSALS_AI_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={pending}
                  className={chipClass}
                  data-test={`disposals-ai-preset-${preset.id}`}
                  onClick={() => {
                    setPrompt(preset.prompt);
                    setFormat(preset.format);
                    run({ prompt: preset.prompt, format: preset.format });
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <div
                role="radiogroup"
                aria-label="Output format"
                className="inline-flex overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)]"
              >
                {DISPOSALS_AI_FORMATS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={format === option}
                    onClick={() => setFormat(option)}
                    className={`h-8 px-3 text-xs font-medium transition-colors ${
                      format === option
                        ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                        : 'text-[var(--workspace-shell-text)]/60 hover:text-[var(--workspace-shell-text)]'
                    }`}
                  >
                    {DISPOSALS_AI_FORMAT_LABELS[option]}
                  </button>
                ))}
              </div>
              <Textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={onPromptKeyDown}
                maxLength={DISPOSALS_AI_PROMPT_MAX_LENGTH}
                rows={3}
                placeholder="e.g. How did we do in September 2026 vs September 2025?"
                data-test="disposals-ai-prompt"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Mention a period like “last month”, “September 2025” or “this
                  year vs last year”. Defaults to last month.
                </p>
                <Button
                  type="button"
                  disabled={pending || prompt.trim().length < 3}
                  className={workspaceBtnPrimaryMd}
                  data-test="disposals-ai-submit"
                  onClick={() => run({ prompt, format })}
                >
                  {pending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {format === 'answer' ? 'Ask' : 'Draft'}
                </Button>
              </div>
            </div>

            {error ? (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            ) : null}

            {pending && !result ? (
              <div
                role="status"
                className="flex items-center gap-2 py-6 text-sm text-[var(--workspace-shell-text-muted)]"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Reading your disposals…
              </div>
            ) : null}

            {result ? (
              <div
                aria-live="polite"
                aria-busy={pending}
                className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] p-3"
                data-test="disposals-ai-result"
              >
                <Textarea
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={isDraft ? 12 : 8}
                  aria-label="Generated text"
                  className={`border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-sm leading-relaxed ${
                    pending ? 'opacity-50' : ''
                  }`}
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                    Public-safe data only. Review before posting.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending || !lastRequest}
                      className="h-8 border-[color:var(--workspace-shell-border)]"
                      onClick={() => lastRequest && run(lastRequest)}
                    >
                      <RefreshCw
                        className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`}
                      />
                      Regenerate
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!text.trim()}
                      className={`h-8 ${workspaceBtnPrimaryMd}`}
                      data-test="disposals-ai-copy"
                      onClick={() => void copy()}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </Button>
                  </div>
                </div>

                <div className="space-y-2 border-t border-[color:var(--workspace-shell-border)] pt-3">
                  <p className="text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text)]/55 uppercase">
                    Based on
                  </p>
                  <PeriodCounts summary={result.period} />
                  {result.comparison ? (
                    <PeriodCounts summary={result.comparison} />
                  ) : null}
                  {result.dataNotes.map((note, index) => (
                    <p
                      key={index}
                      className="text-xs text-[var(--workspace-shell-text-muted)]"
                    >
                      {note}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
