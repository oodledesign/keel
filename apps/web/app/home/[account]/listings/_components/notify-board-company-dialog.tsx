'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import type { BoardNotifyStatus } from '~/lib/commercial/board-company-settings';
import {
  boardStatusLabel,
  collectBoardNotifyRecipients,
  dedupeBoardEmails,
  isValidBoardEmail,
  splitEmailDraft,
} from '~/lib/commercial/board-company-settings';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  type BoardNotifyPreview,
  prepareBoardNotifyAction,
  sendBoardNotifyAction,
  skipBoardNotifyAction,
} from '../_lib/server/board-notify-actions';

function EmailChip({
  email,
  onRemove,
}: {
  email: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text)]">
      <span className="truncate">{email}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-panel-hover)] hover:text-[var(--workspace-shell-text)]"
        aria-label={`Remove ${email}`}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export function NotifyBoardCompanyDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  listingId,
  status,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug?: string | null;
  listingId: string;
  status: BoardNotifyStatus;
}) {
  const [preview, setPreview] = useState<BoardNotifyPreview | null>(null);
  const [savedEmail, setSavedEmail] = useState('');
  const [includeSaved, setIncludeSaved] = useState(false);
  const [customEmails, setCustomEmails] = useState<string[]>([]);
  const [draft, setDraft] = useState('');
  const [recipientError, setRecipientError] = useState<string | null>(null);
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();
  const settledRef = useRef(false);

  useEffect(() => {
    if (!open) return;

    settledRef.current = false;
    let cancelled = false;

    startLoad(async () => {
      try {
        const next = await prepareBoardNotifyAction({
          accountId,
          listingId,
          status,
          accountSlug: accountSlug ?? undefined,
        });
        if (cancelled) return;
        setPreview(next);
        setSavedEmail(next.to);
        setIncludeSaved(Boolean(next.to));
        setCustomEmails([]);
        setDraft('');
        setRecipientError(null);
        setCc(next.cc);
        setSubject(next.subject);
        setBody(next.body);
        setLoadError(null);
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Could not prepare email',
        );
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, accountId, accountSlug, listingId, status]);

  const committed = collectBoardNotifyRecipients({
    savedEmail,
    includeSaved,
    customEmails,
  });
  const { recipients, invalid } = collectBoardNotifyRecipients({
    savedEmail,
    includeSaved,
    customEmails,
    draft,
  });
  const canSend =
    recipients.length > 0 &&
    invalid.length === 0 &&
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    !sending;

  const addCustomEmails = (raw: string) => {
    const parts = splitEmailDraft(raw);
    if (parts.length === 0) return;

    const bad = parts.filter((email) => !isValidBoardEmail(email));
    if (bad.length > 0) {
      setRecipientError('Enter a valid email address');
      setDraft(bad.join(', '));
    } else {
      setRecipientError(null);
      setDraft('');
    }

    const good = parts.filter((email) => isValidBoardEmail(email));
    if (good.length === 0) return;

    setCustomEmails((current) => {
      const savedKey = includeSaved ? savedEmail.trim().toLowerCase() : '';
      const next = dedupeBoardEmails([...current, ...good]).filter(
        (email) => email.toLowerCase() !== savedKey,
      );
      return next;
    });
  };

  const recordSkip = async () => {
    if (settledRef.current) return;
    settledRef.current = true;
    try {
      await skipBoardNotifyAction({ accountId, listingId, status });
      toast.message('Board company not notified');
    } catch {
      toast.message('Board company not notified');
    }
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && !settledRef.current) {
      void recordSkip().finally(() => onOpenChange(false));
      return;
    }
    onOpenChange(next);
  };

  const handleNotNow = () => {
    startSend(async () => {
      await recordSkip();
      onOpenChange(false);
    });
  };

  const handleSend = () => {
    const pending = collectBoardNotifyRecipients({
      savedEmail,
      includeSaved,
      customEmails,
      draft,
    });
    if (pending.invalid.length > 0) {
      setRecipientError('Enter a valid email address');
      return;
    }
    if (pending.recipients.length === 0) {
      setRecipientError('Add at least one recipient');
      return;
    }
    if (!subject.trim() || !body.trim() || sending) return;

    startSend(async () => {
      try {
        await sendBoardNotifyAction({
          accountId,
          listingId,
          status,
          to: pending.recipients,
          cc: cc.trim(),
          subject: subject.trim(),
          body: body.trim(),
        });
        settledRef.current = true;
        toast.success('Board company notified');
        onOpenChange(false);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send email',
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <DialogHeader>
          <DialogTitle className="text-[var(--workspace-shell-text)]">
            Notify board company?
          </DialogTitle>
          <p className="text-sm text-[var(--workspace-shell-text-muted)]">
            Status is now {boardStatusLabel(status)}. The saved board address is
            included when one is set — add extra addresses if you need to.
            Nothing is sent until you confirm.
          </p>
        </DialogHeader>

        {loading && !preview ? (
          <div className="flex items-center gap-2 py-8 text-sm text-[var(--workspace-shell-text-muted)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing email…
          </div>
        ) : loadError ? (
          <p className="text-destructive text-sm">{loadError}</p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                To
              </Label>
              <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5">
                {includeSaved && savedEmail ? (
                  <EmailChip
                    email={savedEmail}
                    onRemove={() => setIncludeSaved(false)}
                  />
                ) : null}
                {customEmails.map((email) => (
                  <EmailChip
                    key={email.toLowerCase()}
                    email={email}
                    onRemove={() =>
                      setCustomEmails((current) =>
                        current.filter(
                          (item) => item.toLowerCase() !== email.toLowerCase(),
                        ),
                      )
                    }
                  />
                ))}
                <input
                  value={draft}
                  onChange={(event) => {
                    setDraft(event.target.value);
                    if (recipientError) setRecipientError(null);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ',') {
                      event.preventDefault();
                      addCustomEmails(draft);
                    } else if (
                      event.key === 'Backspace' &&
                      draft === '' &&
                      customEmails.length > 0
                    ) {
                      setCustomEmails((current) => current.slice(0, -1));
                    }
                  }}
                  onBlur={() => {
                    if (draft.trim()) addCustomEmails(draft);
                  }}
                  placeholder={
                    recipients.length === 0 ? 'name@company.com' : 'Add email'
                  }
                  aria-label="Add recipient"
                  className="min-w-[10rem] flex-1 bg-transparent px-1 py-1 text-sm text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text)]/30"
                />
              </div>
              {savedEmail && !includeSaved ? (
                <button
                  type="button"
                  className="text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
                  onClick={() => setIncludeSaved(true)}
                >
                  Include saved board email ({savedEmail})
                </button>
              ) : null}
              {recipientError ? (
                <p className="text-destructive text-sm">{recipientError}</p>
              ) : committed.recipients.length === 0 && !draft.trim() ? (
                <p className="text-destructive text-sm">
                  Add at least one recipient
                </p>
              ) : (
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Saved board email, extra addresses, or both. Press Enter to
                  add.
                </p>
              )}
              {!savedEmail ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  No board company email is saved.
                  {preview?.settingsHref ? (
                    <>
                      {' '}
                      <Link
                        href={preview.settingsHref}
                        className="text-[var(--ozer-info)] underline-offset-2 hover:underline"
                      >
                        Add board company email
                      </Link>
                    </>
                  ) : null}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                CC (optional)
              </Label>
              <Input
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Subject
              </Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[var(--workspace-shell-text)]/70">
                Body
              </Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={9}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] text-sm"
              />
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            data-test="board-notify-skip"
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            onClick={handleNotNow}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={!canSend || loading || Boolean(loadError)}
            data-test="board-notify-send"
            className={workspaceBtnPrimaryMd}
            onClick={handleSend}
          >
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
