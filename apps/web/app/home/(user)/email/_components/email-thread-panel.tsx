'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Send,
  Sparkles,
  X,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';
import { cn } from '@kit/ui/utils';

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { listTemplatesPickerAction } from '~/lib/content-templates/account.actions';
import type { PickerTemplate } from '~/lib/content-templates/types';
import {
  addEmailTriageRuleFromThreadAction,
  setEmailThreadCategoryAction,
  setEmailThreadFollowUpAction,
} from '~/lib/email-assistant/email-assistant.actions';
import {
  EMAIL_THREAD_CATEGORIES,
  EMAIL_THREAD_CATEGORY_LABELS,
  type EmailThreadCategory,
  categoryFromTriageRuleAction,
} from '~/lib/email-assistant/email-thread-categories';
import type {
  EmailTriageAction,
  EmailTriageScope,
} from '~/lib/email-assistant/email-triage-rules.shared';
import { triageRuleSuccessMessage } from '~/lib/email-assistant/email-triage-rules.shared';
import { formatEmailDateTime } from '~/lib/email-assistant/format-email-date';
import {
  previewEmailBody,
  splitEmailQuotedHistory,
} from '~/lib/email-assistant/message-body-display';

import { loadEmailThreadDetail } from '../_lib/actions/email-assistant-actions';
import { EMAIL_CATEGORY_STYLES } from '../_lib/email-category-styles';
import { EmailApiError, emailApiFetch } from '../_lib/email-api';
import type {
  EmailGmailLabel,
  EmailActionItemRow,
  EmailDraftRow,
  EmailMessageRow,
  EmailThreadDetail,
  EmailThreadSummary,
  EmailWorkspaceOption,
} from '../_lib/types';
import { AcceptActionItemDialog } from './accept-action-item-dialog';
import { EmailCategoryBadge } from './email-category-badge';
import { EmailLabelChips } from './email-label-chips';
import { EmailLabelsPicker } from './email-labels-picker';
import { EmailReviewModeIndicator } from './email-review-mode-indicator';
import { EmailThreadLeadSection } from './email-thread-lead-section';
import { EmailThreadLinkSection } from './email-thread-link-section';
import { EmailTriageRulesMenuItems } from './email-triage-rules-menu';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]';

function formatDueDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Date(`${value}T12:00:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function ActionItemStatusPill({ status }: { status: string }) {
  const isAccepted = status === 'accepted';
  const isDismissed = status === 'dismissed';

  return (
    <span
      className={cn(
        'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        isAccepted &&
          'bg-emerald-100 text-emerald-900 ring-1 ring-emerald-200/80 ring-inset dark:bg-emerald-500/15 dark:text-emerald-100 dark:ring-emerald-500/30',
        isDismissed &&
          'bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200/80 ring-inset dark:bg-zinc-500/15 dark:text-zinc-300 dark:ring-zinc-500/30',
        !isAccepted &&
          !isDismissed &&
          'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text-muted)]',
      )}
    >
      {isAccepted ? 'Accepted' : isDismissed ? 'Dismissed' : status}
    </span>
  );
}

type SendDraftPreview = {
  from: string;
  to: string;
  cc?: string;
  subject: string;
};

type Props = {
  threadId: string | null;
  connected: boolean;
  workspaces: EmailWorkspaceOption[];
  gmailLabels?: EmailGmailLabel[];
  mailboxKind?: 'business' | 'personal';
  accountSlug?: string | null;
  preferredAccountId?: string | null;
  reviewMode?: boolean;
  allowSendFromOzer?: boolean;
  focusDraft?: boolean;
  onBack?: () => void;
  showBackButton?: boolean;
  onCategoryChange?: (threadId: string, category: EmailThreadCategory) => void;
};

export function EmailThreadPanel({
  threadId,
  connected,
  workspaces,
  gmailLabels = [],
  mailboxKind = 'personal',
  accountSlug = null,
  preferredAccountId = null,
  reviewMode = false,
  allowSendFromOzer = false,
  focusDraft = false,
  onBack,
  showBackButton = false,
  onCategoryChange,
}: Props) {
  const { reportExhausted, accountId, billingHref } = useAiCreditsExhausted();
  const [detail, setDetail] = useState<EmailThreadDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftBody, setDraftBody] = useState('');
  const [replyPresets, setReplyPresets] = useState<PickerTemplate[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [acceptItem, setAcceptItem] = useState<EmailActionItemRow | null>(null);
  const [acceptOpen, setAcceptOpen] = useState(false);
  const [extractInstructions, setExtractInstructions] = useState('');
  const [sendPreview, setSendPreview] = useState<SendDraftPreview | null>(null);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendPreviewLoading, setSendPreviewLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const draftSectionRef = useRef<HTMLDivElement | null>(null);
  const draftTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!threadId) {
      setDetail(null);
      setDraftBody('');
      setLoadError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    // Clear immediately so we never flash "unavailable" or a stale thread.
    setDetail(null);
    setDraftBody('');
    setLoading(true);
    setLoadError(null);

    void loadEmailThreadDetail(threadId).then((result) => {
      if (cancelled) {
        return;
      }

      if (!result.ok) {
        toast.error(result.error);
        setDetail(null);
        setDraftBody('');
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      setDetail(result.data);
      setDraftBody(result.data.draft?.body_text ?? '');
      setLoadError(null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  useEffect(() => {
    if (!focusDraft || !detail || loading) {
      return;
    }

    const timer = window.setTimeout(() => {
      draftSectionRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      draftTextareaRef.current?.focus({ preventScroll: true });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [detail, focusDraft, loading, threadId]);

  const suggestedItems = useMemo(
    () =>
      (detail?.actionItems ?? []).filter((item) => item.status === 'suggested'),
    [detail?.actionItems],
  );

  const resolvedItems = useMemo(
    () =>
      (detail?.actionItems ?? []).filter((item) => item.status !== 'suggested'),
    [detail?.actionItems],
  );

  function refreshDetail() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      const result = await loadEmailThreadDetail(threadId);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setDetail(result.data);
      setDraftBody(result.data.draft?.body_text ?? '');
    });
  }

  function runSuggestPipelineLead() {
    if (!threadId || mailboxKind !== 'business' || detail?.thread.pipeline_deal_id) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await emailApiFetch<{ thread: EmailThreadSummary }>(
          `/api/gmail/threads/${threadId}/suggest-pipeline-lead`,
          { method: 'POST' },
        );

        setDetail((current) =>
          current
            ? {
                ...current,
                thread: {
                  ...current.thread,
                  pipeline_lead_suggestion:
                    data.thread.pipeline_lead_suggestion,
                  pipeline_lead_confidence: data.thread.pipeline_lead_confidence,
                  pipeline_deal_id: data.thread.pipeline_deal_id,
                },
              }
            : current,
        );

        if (data.thread.pipeline_lead_suggestion) {
          toast.success('Pipeline lead suggestion ready');
        } else {
          toast.message('No new lead detected for this thread');
        }
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not suggest pipeline lead',
        );
      }
    });
  }

  function runExtract() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await emailApiFetch<{ items: EmailActionItemRow[] }>(
          `/api/gmail/threads/${threadId}/extract`,
          {
            method: 'POST',
            body: JSON.stringify({
              instructions: extractInstructions.trim() || undefined,
            }),
          },
        );
        const count = data.items?.length ?? 0;
        if (count === 0) {
          toast.message('No actionable to-dos found in this thread');
        } else {
          toast.success(
            count === 1
              ? '1 suggested to-do added'
              : `${count} suggested to-dos added`,
          );
        }
        refreshDetail();
      } catch (error) {
        if (
          error instanceof EmailApiError &&
          error.code === 'INSUFFICIENT_AI_CREDITS'
        ) {
          reportExhausted({
            accountId,
            billingHref,
            creditsRemaining: error.creditsRemaining,
            creditsRequired: error.creditsRequired,
            error: error.message,
          });
          return;
        }
        toast.error(
          error instanceof Error ? error.message : 'Extraction failed',
        );
      }
    });
  }

  function runDismiss(itemId: string) {
    startTransition(async () => {
      try {
        await emailApiFetch(`/api/email-actions/${itemId}/dismiss`, {
          method: 'POST',
        });
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not dismiss item',
        );
      }
    });
  }

  function runGenerateDraft() {
    if (!threadId) {
      return;
    }

    startTransition(async () => {
      try {
        const data = await emailApiFetch<{ draft: EmailDraftRow }>(
          `/api/gmail/threads/${threadId}/draft`,
          { method: 'POST' },
        );
        setDetail((current) =>
          current ? { ...current, draft: data.draft } : current,
        );
        setDraftBody(data.draft.body_text);
        toast.success('Draft generated');
      } catch (error) {
        if (
          error instanceof EmailApiError &&
          error.code === 'INSUFFICIENT_AI_CREDITS'
        ) {
          reportExhausted({
            accountId,
            billingHref,
            creditsRemaining: error.creditsRemaining,
            creditsRequired: error.creditsRequired,
            error: error.message,
          });
          return;
        }
        toast.error(
          error instanceof Error ? error.message : 'Draft generation failed',
        );
      }
    });
  }

  function runSaveDraft() {
    const draftId = detail?.draft?.id;

    if (!draftId) {
      toast.error('Generate a draft first');
      return;
    }

    if (!draftBody.trim()) {
      toast.error('Draft body is required');
      return;
    }

    startTransition(async () => {
      try {
        await emailApiFetch(`/api/gmail/drafts/${draftId}/save`, {
          method: 'POST',
          body: JSON.stringify({ bodyText: draftBody }),
        });
        toast.success('Saved to Gmail drafts');
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save to Gmail',
        );
      }
    });
  }

  function setCategory(category: EmailThreadCategory) {
    if (!threadId) return;

    startTransition(async () => {
      try {
        const result = await setEmailThreadCategoryAction({
          threadId,
          category,
        });
        setDetail((current) =>
          current
            ? {
                ...current,
                thread: {
                  ...current.thread,
                  assistant_category: category,
                  ...(result.labelIds
                    ? { label_ids: result.labelIds }
                    : {}),
                },
              }
            : current,
        );
        onCategoryChange?.(threadId, category);
        toast.success(`Marked as ${EMAIL_THREAD_CATEGORY_LABELS[category]}`);
        if (result.gmailWarning) {
          toast.message(result.gmailWarning);
        }
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update category',
        );
      }
    });
  }

  function setFollowUp(days: number | null) {
    if (!threadId) return;

    const followUpAt =
      days == null
        ? null
        : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    startTransition(async () => {
      try {
        await setEmailThreadFollowUpAction({
          threadId,
          followUpAt,
          followUpNote: null,
        });
        setDetail((current) =>
          current
            ? {
                ...current,
                thread: {
                  ...current.thread,
                  follow_up_at: followUpAt,
                  follow_up_note: null,
                },
              }
            : current,
        );
        toast.success(
          followUpAt ? 'Follow-up reminder set' : 'Follow-up reminder cleared',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update follow-up',
        );
      }
    });
  }

  function addTriageRule(action: EmailTriageAction, scope: EmailTriageScope) {
    if (!threadId) return;
    startTransition(async () => {
      try {
        const result = await addEmailTriageRuleFromThreadAction({
          threadId,
          action,
          scope,
        });
        const category = categoryFromTriageRuleAction(action);
        setDetail((current) =>
          current
            ? {
                ...current,
                thread: {
                  ...current.thread,
                  assistant_category: category,
                },
              }
            : current,
        );
        onCategoryChange?.(threadId, category);
        toast.success(
          triageRuleSuccessMessage(
            action,
            scope,
            result.value,
            result.affectedCount,
          ),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save triage rule',
        );
      }
    });
  }

  function openSendDialog() {
    const draftId = detail?.draft?.id;

    if (!draftId || !draftBody.trim()) {
      toast.error('Generate a draft with content first');
      return;
    }

    setSendPreviewLoading(true);
    setSendDialogOpen(true);

    void emailApiFetch<{ preview: SendDraftPreview }>(
      `/api/gmail/drafts/${draftId}/send`,
    )
      .then((data) => {
        setSendPreview(data.preview);
      })
      .catch((error) => {
        setSendDialogOpen(false);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load send preview',
        );
      })
      .finally(() => {
        setSendPreviewLoading(false);
      });
  }

  function runSendDraft() {
    const draftId = detail?.draft?.id;

    if (!draftId || !sendPreview) {
      return;
    }

    startTransition(async () => {
      try {
        await emailApiFetch(`/api/gmail/drafts/${draftId}/send`, {
          method: 'POST',
          body: JSON.stringify({ bodyText: draftBody }),
        });
        setSendDialogOpen(false);
        setSendPreview(null);
        toast.success('Email sent from Ozer');
        refreshDetail();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send email',
        );
      }
    });
  }

  if (!threadId) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center px-6 py-12 text-center',
        )}
      >
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Select a thread
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            Choose a conversation from your inbox to review messages, suggested
            to-dos, and draft a reply.
          </p>
        </div>
      </section>
    );
  }

  if (loading || (threadId && !detail && !loadError)) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] flex-col overflow-hidden',
        )}
      >
        <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div className="space-y-2">
            <div className="h-5 w-2/3 max-w-md animate-pulse rounded bg-[var(--workspace-shell-sidebar-accent)]" />
            <div className="h-3 w-24 animate-pulse rounded bg-[var(--workspace-shell-sidebar-accent)]" />
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-sm text-[var(--workspace-shell-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--ozer-accent)]" />
          Loading thread…
        </div>
      </section>
    );
  }

  if (!detail) {
    return (
      <section
        className={cn(
          panelClass,
          'flex min-h-[320px] items-center justify-center px-6 py-12 text-center',
        )}
      >
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {loadError ? 'Could not load thread' : 'Thread unavailable'}
          </p>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
            {loadError ?? 'Choose another conversation from your inbox.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section
        className={cn(
          panelClass,
          'flex h-full min-h-0 min-w-0 flex-col overflow-hidden',
        )}
      >
        <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div className="flex items-start gap-3">
            {showBackButton && onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-0.5 shrink-0 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)] lg:hidden"
                onClick={onBack}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-base font-semibold text-[var(--workspace-shell-text)]">
                {detail.thread.subject?.trim() || '(no subject)'}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  {detail.messages.length} message
                  {detail.messages.length === 1 ? '' : 's'}
                </p>
                <EmailCategoryBadge
                  category={detail.thread.assistant_category}
                  reason={detail.thread.assistant_category_reason}
                  confidence={detail.thread.assistant_category_confidence}
                  showWhy
                />
                <EmailLabelChips
                  labelIds={detail.thread.label_ids}
                  labels={gmailLabels}
                  max={6}
                />
                {reviewMode ? <EmailReviewModeIndicator /> : null}
              </div>
            </div>
            <EmailLabelsPicker
              threadId={detail.thread.id}
              labelIds={detail.thread.label_ids ?? []}
              labels={gmailLabels}
              onLabelsChange={(labelIds) => {
                setDetail((current) =>
                  current
                    ? {
                        ...current,
                        thread: {
                          ...current.thread,
                          label_ids: labelIds,
                        },
                      }
                    : current,
                );
              }}
            />
            <EmailThreadLinkSection
              threadId={threadId}
              link={detail.thread.link}
              linkSuggestion={detail.thread.link_suggestion}
              linkConfidence={detail.thread.link_confidence}
              workspaces={workspaces}
              preferredAccountId={preferredAccountId}
              onUpdated={(link) => {
                setDetail((current) =>
                  current
                    ? { ...current, thread: { ...current.thread, link } }
                    : current,
                );
              }}
              onSuggestionUpdated={(link_suggestion) => {
                setDetail((current) =>
                  current
                    ? {
                        ...current,
                        thread: { ...current.thread, link_suggestion },
                      }
                    : current,
                );
              }}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-0.5 shrink-0 border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)]"
                  disabled={pending}
                >
                  {detail.thread.assistant_category ? (
                    <span
                      className={cn(
                        'mr-1.5 h-2 w-2 shrink-0 rounded-full',
                        EMAIL_CATEGORY_STYLES[detail.thread.assistant_category]
                          .dot,
                      )}
                      aria-hidden
                    />
                  ) : null}
                  Category
                  <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {EMAIL_THREAD_CATEGORIES.map((category) => {
                  const styles = EMAIL_CATEGORY_STYLES[category];

                  return (
                    <DropdownMenuItem
                      key={category}
                      disabled={
                        pending || detail.thread.assistant_category === category
                      }
                      onSelect={() => setCategory(category)}
                    >
                      <span
                        className={cn(
                          'mr-2 h-2 w-2 shrink-0 rounded-full',
                          styles.dot,
                        )}
                        aria-hidden
                      />
                      {EMAIL_THREAD_CATEGORY_LABELS[category]}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {detail.thread.assistant_category_reason?.trim() ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-0.5 shrink-0 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                      aria-label="Why this category?"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    <p className="font-medium">Why this category?</p>
                    <p className="mt-1 text-[var(--workspace-shell-text-muted)]">
                      {detail.thread.assistant_category_reason.trim()}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-0.5 shrink-0 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
                  disabled={pending}
                  aria-label="Thread triage actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {mailboxKind === 'business' &&
                !detail.thread.pipeline_deal_id ? (
                  <DropdownMenuItem
                    disabled={pending}
                    onSelect={runSuggestPipelineLead}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Re-scan for pipeline lead
                  </DropdownMenuItem>
                ) : null}
                {mailboxKind === 'business' &&
                !detail.thread.pipeline_deal_id ? (
                  <DropdownMenuSeparator />
                ) : null}
                <EmailTriageRulesMenuItems
                  subject={detail.thread.subject}
                  disabled={pending}
                  onSelectRule={addTriageRule}
                />
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="shrink-0 border-b border-[color:var(--workspace-shell-border)] px-4 py-3">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-[var(--workspace-shell-text-muted)]">
              Follow-up
            </span>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-[color:var(--workspace-shell-border)] bg-transparent px-2.5 text-xs"
              disabled={pending}
              onClick={() => setFollowUp(1)}
            >
              1d
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-[color:var(--workspace-shell-border)] bg-transparent px-2.5 text-xs"
              disabled={pending}
              onClick={() => setFollowUp(3)}
            >
              3d
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-[color:var(--workspace-shell-border)] bg-transparent px-2.5 text-xs"
              disabled={pending}
              onClick={() => setFollowUp(7)}
            >
              1w
            </Button>
            {detail.thread.follow_up_at ? (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2.5 text-xs text-[var(--workspace-shell-text-muted)]"
                disabled={pending}
                onClick={() => setFollowUp(null)}
              >
                Clear
              </Button>
            ) : null}
            {detail.thread.follow_up_at ? (
              <span className="text-xs text-[var(--ozer-accent)]">
                Reminder {formatEmailDateTime(detail.thread.follow_up_at)}
              </span>
            ) : null}
          </div>
          {mailboxKind === 'business' &&
          (detail.thread.pipeline_deal_id ||
            detail.thread.pipeline_lead_suggestion ||
            (!detail.thread.link.linked && !detail.thread.link.clientId)) ? (
            <EmailThreadLeadSection
              threadId={threadId}
              mailboxKind={mailboxKind}
              accountSlug={accountSlug}
              pipelineLeadSuggestion={detail.thread.pipeline_lead_suggestion}
              pipelineLeadConfidence={detail.thread.pipeline_lead_confidence}
              pipelineDealId={detail.thread.pipeline_deal_id}
              workspaces={workspaces}
              onUpdated={(patch) => {
                setDetail((current) =>
                  current
                    ? {
                        ...current,
                        thread: { ...current.thread, ...patch },
                      }
                    : current,
                );
              }}
            />
          ) : null}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-x-hidden overflow-y-auto p-4">
          <ThreadMessages messages={detail.messages} />

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Suggested to-dos
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                onClick={runExtract}
                disabled={pending || !connected}
              >
                {pending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {suggestedItems.length > 0 ? 'Refresh' : 'Extract'}
              </Button>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="email-extract-instructions"
                className="text-xs text-[var(--workspace-shell-text-muted)]"
              >
                Extraction instructions{' '}
                <span className="font-normal">(optional)</span>
              </Label>
              <Textarea
                id="email-extract-instructions"
                value={extractInstructions}
                onChange={(e) => setExtractInstructions(e.target.value)}
                placeholder="e.g. Put everything I need to email the client into one task, with bullet points in the notes"
                className="min-h-[68px] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
              />
            </div>

            {suggestedItems.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-5 text-sm text-[var(--workspace-shell-text-muted)]">
                No open suggestions yet. Extract action items from this thread
                with AI.
              </p>
            ) : (
              <ul className="space-y-2">
                {suggestedItems.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/50 p-3"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                          {item.title}
                        </p>
                        {item.detail ? (
                          <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
                            {item.detail}
                          </p>
                        ) : null}
                        {item.suggested_due_date || item.linkLabel ? (
                          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--workspace-shell-text-muted)]">
                            {item.suggested_due_date ? (
                              <span>
                                Suggested due{' '}
                                {formatDueDate(item.suggested_due_date)}
                              </span>
                            ) : null}
                            {item.suggested_due_date && item.linkLabel ? (
                              <span className="text-[var(--workspace-shell-text-muted)]">
                                ·
                              </span>
                            ) : null}
                            {item.linkLabel ? (
                              <span className="text-[var(--ozer-accent)]">
                                {item.linkLabel}
                              </span>
                            ) : null}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2 sm:flex-nowrap">
                        <Button
                          type="button"
                          size="sm"
                          className="ozer-gradient-btn h-8 px-3 text-[var(--workspace-shell-text)]"
                          onClick={() => {
                            setAcceptItem(item);
                            setAcceptOpen(true);
                          }}
                          disabled={pending}
                        >
                          <Check className="mr-1 h-3.5 w-3.5" />
                          Accept
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 border-[color:var(--workspace-shell-border)] bg-transparent px-3 text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                          onClick={() => runDismiss(item.id)}
                          disabled={pending}
                        >
                          <X className="mr-1 h-3.5 w-3.5" />
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {resolvedItems.length > 0 ? (
              <div className="space-y-2 pt-2">
                <p className="text-xs font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
                  Resolved
                </p>
                <ul className="space-y-2">
                  {resolvedItems.map((item) => {
                    const dismissed = item.status === 'dismissed';

                    return (
                      <li
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
                      >
                        <span
                          className={cn(
                            'min-w-0 flex-1 text-sm text-[var(--workspace-shell-text-muted)]',
                            dismissed && 'line-through',
                          )}
                        >
                          {item.title}
                        </span>
                        <ActionItemStatusPill status={item.status} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}
          </div>

          <div
            ref={draftSectionRef}
            className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
                Draft reply
              </h3>
              <div className="flex items-center gap-2">
                <DropdownMenu
                  onOpenChange={(open) => {
                    if (!open || presetsLoaded) return;
                    void listTemplatesPickerAction({ kind: 'email_reply' })
                      .then((rows) => {
                        setReplyPresets(rows);
                        setPresetsLoaded(true);
                      })
                      .catch(() => {
                        setReplyPresets([]);
                        setPresetsLoaded(true);
                      });
                  }}
                >
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)]"
                      disabled={!connected}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      Insert preset
                      <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-w-xs">
                    {!presetsLoaded ? (
                      <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
                    ) : replyPresets.length === 0 ? (
                      <DropdownMenuItem disabled>
                        No presets yet — add some in Email settings
                      </DropdownMenuItem>
                    ) : (
                      replyPresets.map((preset) => (
                        <DropdownMenuItem
                          key={`${preset.source}:${preset.id}`}
                          onSelect={() => {
                            const text = preset.bodyText.trim();
                            if (!text) return;
                            setDraftBody((prev) =>
                              prev.trim() ? `${prev.trim()}\n\n${text}` : text,
                            );
                            toast.success(`Inserted “${preset.name}”`);
                          }}
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {preset.name}
                            </span>
                            <span className="text-muted-foreground block truncate text-xs">
                              {preset.source}
                            </span>
                          </span>
                        </DropdownMenuItem>
                      ))
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  onClick={runGenerateDraft}
                  disabled={pending || !connected}
                >
                  {pending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generate
                </Button>
              </div>
            </div>

            <Textarea
              ref={draftTextareaRef}
              value={draftBody}
              onChange={(event) => setDraftBody(event.target.value)}
              placeholder="Generate a reply, edit it here, then save to Gmail."
              rows={10}
              className="border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] text-[var(--workspace-shell-text)] placeholder:text-[var(--workspace-shell-text-muted)]"
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                className="ozer-gradient-btn text-[var(--ozer-white)]"
                onClick={runSaveDraft}
                disabled={pending || !connected || !detail.draft}
              >
                Save to Gmail
              </Button>
              {allowSendFromOzer && draftBody.trim() ? (
                <Button
                  type="button"
                  variant="outline"
                  className="border-[color:var(--workspace-shell-border)] bg-transparent text-[var(--workspace-shell-text)] hover:bg-[var(--workspace-shell-sidebar-accent)]"
                  onClick={openSendDialog}
                  disabled={pending || !connected || !detail.draft}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Send
                </Button>
              ) : null}
              {detail.draft?.status === 'saved_to_gmail' ? (
                <span className="text-xs text-[var(--ozer-accent)]">
                  Saved to Gmail
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <AlertDialog
        open={sendDialogOpen}
        onOpenChange={(open) => {
          setSendDialogOpen(open);
          if (!open) {
            setSendPreview(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this reply from Ozer?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {sendPreviewLoading ? (
                  <p className="flex items-center gap-2 text-[var(--workspace-shell-text-muted)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading preview…
                  </p>
                ) : sendPreview ? (
                  <>
                    <p>
                      <span className="font-medium">From:</span>{' '}
                      {sendPreview.from}
                    </p>
                    <p>
                      <span className="font-medium">To:</span> {sendPreview.to}
                    </p>
                    {sendPreview.cc ? (
                      <p>
                        <span className="font-medium">Cc:</span>{' '}
                        {sendPreview.cc}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-medium">Subject:</span>{' '}
                      {sendPreview.subject}
                    </p>
                    <p className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)] p-3 whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                      {draftBody.trim()}
                    </p>
                  </>
                ) : (
                  <p className="text-[var(--workspace-shell-text-muted)]">
                    Could not load send preview.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending || sendPreviewLoading || !sendPreview}
              onClick={(event) => {
                event.preventDefault();
                runSendDraft();
              }}
            >
              {pending ? 'Sending…' : 'Send email'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AcceptActionItemDialog
        open={acceptOpen}
        onOpenChange={setAcceptOpen}
        actionItem={acceptItem}
        threadLink={detail.thread.link}
        workspaces={workspaces}
        onAccepted={refreshDetail}
      />
    </>
  );
}

function ThreadMessages({ messages }: { messages: EmailMessageRow[] }) {
  const [expandedOlderIds, setExpandedOlderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [showQuotedIds, setShowQuotedIds] = useState<Set<string>>(
    () => new Set(),
  );

  useEffect(() => {
    setExpandedOlderIds(new Set());
    setShowQuotedIds(new Set());
  }, [messages]);

  if (messages.length === 0) {
    return null;
  }

  const latestMessageId = messages[messages.length - 1]?.id;

  function toggleOlderMessage(messageId: string) {
    setExpandedOlderIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  function toggleQuotedHistory(messageId: string) {
    setShowQuotedIds((current) => {
      const next = new Set(current);

      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }

      return next;
    });
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
        Messages
      </h3>
      <ul className="space-y-2">
        {messages.map((message) => {
          const isLatest = message.id === latestMessageId;
          const isExpanded = isLatest || expandedOlderIds.has(message.id);
          const rawBody =
            message.body_text?.trim() || message.snippet?.trim() || '';
          const { visible, quoted } = splitEmailQuotedHistory(rawBody);
          const body = visible || '(no content)';
          const preview = previewEmailBody(rawBody);
          const showQuoted = showQuotedIds.has(message.id);

          if (!isExpanded) {
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => toggleOlderMessage(message.id)}
                  className="flex w-full items-start gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/25 px-3 py-2.5 text-left transition-colors hover:bg-[var(--ozer-surface-canvas)]/40"
                >
                  <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-medium text-[var(--workspace-shell-text-muted)]">
                        {message.from_address ?? 'Unknown sender'}
                      </p>
                      <p className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
                        {formatEmailDateTime(message.internal_date)}
                      </p>
                    </div>
                    {preview ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--workspace-shell-text-muted)]">
                        {preview}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          }

          return (
            <li
              key={message.id}
              className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--ozer-surface-canvas)]/40 p-3"
            >
              <div className="flex items-start gap-2">
                {!isLatest ? (
                  <button
                    type="button"
                    onClick={() => toggleOlderMessage(message.id)}
                    className="mt-0.5 shrink-0 rounded-md p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text-muted)]"
                    aria-label="Collapse message"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-sm font-medium break-words text-[var(--workspace-shell-text)]">
                      {message.from_address ?? 'Unknown sender'}
                    </p>
                    <p className="shrink-0 text-xs text-[var(--workspace-shell-text-muted)] tabular-nums">
                      {formatEmailDateTime(message.internal_date)}
                    </p>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed break-words whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                    {body}
                  </p>
                  {quoted ? (
                    <div className="mt-3">
                      <button
                        type="button"
                        onClick={() => toggleQuotedHistory(message.id)}
                        className="text-xs font-medium text-[var(--ozer-accent)] hover:underline"
                      >
                        {showQuoted
                          ? 'Hide quoted history'
                          : 'Show quoted history'}
                      </button>
                      {showQuoted ? (
                        <p className="mt-2 border-l border-[color:var(--workspace-shell-border)] pl-3 text-sm leading-relaxed whitespace-pre-wrap text-[var(--workspace-shell-text-muted)]">
                          {quoted}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
