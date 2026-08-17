'use client';

import { useEffect, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import {
  circulateListingAction,
  listListingCirculationCandidates,
} from '../_lib/server/circulation-actions';
import type { CirculationCandidate } from '~/lib/commercial/circulation/circulate-listing';

type Props = {
  accountId: string;
  listingId: string;
  defaultFromEmail?: string | null;
  defaultFromName?: string | null;
};

export function ListingCirculateDialog({
  accountId,
  listingId,
  defaultFromEmail,
  defaultFromName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [candidates, setCandidates] = useState<CirculationCandidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fromEmail, setFromEmail] = useState(defaultFromEmail ?? '');
  const [fromName, setFromName] = useState(defaultFromName ?? '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listListingCirculationCandidates({ accountId, listingId })
      .then((rows) => {
        setCandidates(rows);
        setSelected(
          new Set(
            rows.filter((r) => r.subscribed).map((r) => r.requirementId),
          ),
        );
      })
      .catch((err) => {
        toast.error(
          err instanceof Error ? err.message : 'Could not load matches',
        );
      })
      .finally(() => setLoading(false));
  }, [open, accountId, listingId]);

  function toggle(id: string, enabled: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (enabled) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function send() {
    if (!fromEmail.trim()) {
      toast.error('Set a From email on a verified SES domain');
      return;
    }
    startTransition(async () => {
      try {
        const result = await circulateListingAction({
          accountId,
          listingId,
          requirementIds: [...selected],
          fromEmail: fromEmail.trim(),
          fromName: fromName.trim() || undefined,
          replyTo: fromEmail.trim(),
        });
        toast.success(
          `Circulation sent: ${result.sent} delivered, ${result.skipped} skipped, ${result.failed} failed`,
        );
        setOpen(false);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Circulation failed',
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="outline">
          Circulate
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Circulate matching requirements</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Sends via Amazon SES to subscribed applicants. Preview the list, then
          confirm.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>From name</Label>
            <Input
              value={fromName}
              onChange={(e) => setFromName(e.target.value)}
              placeholder="Agency name"
            />
          </div>
          <div className="grid gap-1.5">
            <Label>From email (SES verified)</Label>
            <Input
              type="email"
              value={fromEmail}
              onChange={(e) => setFromEmail(e.target.value)}
              placeholder="lettings@agency.co.uk"
            />
          </div>
        </div>

        <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-[var(--workspace-shell-border)] p-2">
          {loading ? (
            <p className="p-2 text-sm text-[var(--workspace-shell-text-muted)]">
              Loading matches…
            </p>
          ) : candidates.length === 0 ? (
            <p className="p-2 text-sm text-[var(--workspace-shell-text-muted)]">
              No matching subscribed requirements found.
            </p>
          ) : (
            candidates.map((c) => (
              <label
                key={c.requirementId}
                className="flex items-start gap-2 rounded-md p-2 hover:bg-[var(--workspace-shell-sidebar-accent)]"
              >
                <Checkbox
                  checked={selected.has(c.requirementId)}
                  disabled={!c.subscribed}
                  onCheckedChange={(v) =>
                    toggle(c.requirementId, Boolean(v))
                  }
                />
                <span className="min-w-0 flex-1 text-sm">
                  <span className="font-medium text-[var(--workspace-shell-text)]">
                    {c.contactName || c.email}
                  </span>
                  {c.companyName ? (
                    <span className="text-[var(--workspace-shell-text-muted)]">
                      {' '}
                      · {c.companyName}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-xs text-[var(--workspace-shell-text-muted)]">
                    {c.email} · score {c.score}
                    {!c.subscribed ? ' · not subscribed' : ''}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={pending || selected.size === 0}
            onClick={send}
          >
            {pending ? 'Sending…' : `Send to ${selected.size}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
