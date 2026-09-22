'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2 } from 'lucide-react';

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
import { boardStatusLabel } from '~/lib/commercial/board-company-settings';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import {
  type BoardNotifyPreview,
  prepareBoardNotifyAction,
  sendBoardNotifyAction,
  skipBoardNotifyAction,
} from '../_lib/server/board-notify-actions';

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
  const [to, setTo] = useState('');
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
        setTo(next.to);
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

  const configured = Boolean(preview?.configured);
  const canSend =
    configured &&
    Boolean(to.trim()) &&
    Boolean(subject.trim()) &&
    Boolean(body.trim()) &&
    !sending;

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
    if (!canSend) return;
    startSend(async () => {
      try {
        await sendBoardNotifyAction({
          accountId,
          listingId,
          status,
          to: to.trim(),
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
            Status is now {boardStatusLabel(status)}. Preview and edit the email
            before sending — nothing is sent until you confirm.
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
              <Input
                type="email"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Board company email"
                disabled={!configured}
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]"
              />
              {!configured ? (
                <p className="text-sm text-[var(--workspace-shell-text-muted)]">
                  Add a board company email in settings to enable Send.
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
                disabled={!configured}
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
            className="border-[color:var(--workspace-shell-border)] text-[var(--workspace-shell-text-muted)]"
            onClick={handleNotNow}
          >
            Not now
          </Button>
          <Button
            type="button"
            disabled={!canSend || loading || Boolean(loadError)}
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
